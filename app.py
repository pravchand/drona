import string
import random
import sqlite3
from flask import Flask, g, request, jsonify, send_from_directory
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
import uuid
from typing import Optional, Dict, Any
import os
from openai import OpenAI
import parser as p

app = Flask(__name__, static_folder='static')
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

####################### Database initialization #######################
def init_db():
    db_path = os.path.join(os.getcwd(), 'db', 'belay.sqlite3')
    migrations_path = os.path.join(os.getcwd(), 'db')

    os.makedirs(os.path.dirname(db_path), exist_ok=True)

    try:
        # Connect to the SQLite database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # List all migration files and sort them
        migration_files = sorted(
            [f for f in os.listdir(migrations_path) if f.endswith('.sql')],
            key=lambda x: x  # Sorts filenames in lexicographical order (timestamps ensure correct order)
        )

        for migration_file in migration_files:
            migration_file_path = os.path.join(migrations_path, migration_file)
            print(f"Applying migration: {migration_file_path}")

            # Read and execute the SQL script for each migration file
            with open(migration_file_path, 'r') as file:
                sql_script = file.read()
                cursor.executescript(sql_script)

        conn.commit()
        print("Database initialized successfully.")
    except sqlite3.Error as e:
        print(f"An error occurred while initializing the database: {e}")
    except FileNotFoundError:
        print(f"SQL file not found in: {migrations_path}")
    finally:
        if conn:
            conn.close()

with app.app_context():
    init_db()
    
############################################################################################
def get_db() -> sqlite3.Connection:
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect('db/belay.sqlite3')
        db.row_factory = sqlite3.Row
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def query_db(query: str, args: tuple = (), one: bool = False) -> Optional[Any]:
    db = get_db()
    cursor = db.cursor()
    cursor.execute(query, args)
    rows = cursor.fetchall()
    db.commit()
    
    if rows:
        return rows[0] if one else rows
    return None

def token_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({"error": "Authentication token is missing"}), 401
        
        user = get_user_from_token(token)
        if not user:
            return jsonify({"error": "Invalid or expired token"}), 401
        
        return f(user['id'], *args, **kwargs)
    return decorated_function

def get_user_from_token(token: str) -> Optional[Dict[str, Any]]:
    user = query_db('SELECT * FROM users WHERE session_token = ?', (token,), one=True)
    return dict(user) if user else None

def generate_unique_username() -> str:
    while True:
        username = f"User_{random.randint(1000, 9999)}"
        existing = query_db('SELECT * FROM users WHERE username = ?', (username,), one=True)
        if not existing:
            return username
        
########################## APP ROUTES #########################################
@app.route('/')
@app.route('/profile')
@app.route('/login')
@app.route('/channel')
@app.route('/channel/<channel_id>')
@app.route('/replies')
def serve_spa(channel_id = None):
    return send_from_directory('static', 'index.html')

########################## API ROUTES #########################################
@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.json
    username = data.get('username', generate_unique_username())
    password = data.get('password')

    if not password:
        return jsonify({"error": "Password is required"}), 400

    # Check if username exists
    existing_user = query_db('SELECT * FROM users WHERE username = ?', (username,), one=True)
    if existing_user:
        return jsonify({"error": "Username already exists"}), 400

    # Hash password
    hashed_password = generate_password_hash(password)
    
    # Generate session token
    session_token = str(uuid.uuid4())

    try:
        # Insert new user
        user_id = query_db(
            'INSERT INTO users (username, password, session_token) VALUES (?, ?, ?) RETURNING id', 
            (username, hashed_password, session_token), 
            one=True
        )['id']

        return jsonify({
            'token': session_token, 
            'user_id': user_id,
            'username': username
        }), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    print(username)
    print(password)
    user = query_db('SELECT * FROM users WHERE username = ?', (username,), one=True)
    print(user['password'])
    if user and (user['password'] == password):
        # Generate new session token
        session_token = str(uuid.uuid4())
        query_db('UPDATE users SET session_token = ? WHERE id = ?', (session_token, user['id']))
        
        return jsonify({
            'token': session_token, 
            'user_id': user['id']
        }), 200
    
    return jsonify({"error": "Invalid credentials"}), 401

# Change name of a channel
@app.route('/api/channels/name', methods=['POST'])
@token_required
def change_room_name(user_id):
    data = request.json
    new_name = data.get('new_name')
    room_id = data.get('room_id')

    if not room_id or not new_name:
        return jsonify({"error": "room_id and new_name are required"}), 400

    try:
        query_db('UPDATE channels SET name = ? WHERE id = ?', (new_name, room_id))
        return jsonify({"message": "Room name updated successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    


#username update
@app.route('/api/profile/username', methods=['POST'])
@token_required
def update_username(user_id):
    data = request.json
    new_name = data.get('new_username')

    if not new_name:
        return jsonify({"error": "Username is required"}), 400

    try:
        u = query_db('UPDATE users SET username = ? WHERE id = ? RETURNING username', (new_name, user_id), one=True)
        return jsonify({"username": u['username']}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    

#update password
@app.route('/api/profile/password', methods = ['POST'])
@token_required
def update_password(user_id):
    message = request.json
    new_password = message.get('new_password')
    token = request.headers.get('Authorization')
    if not new_password:
        return jsonify({"error": "New password is required"}), 400
    try:
        # Update password in the database
        query_db('UPDATE users SET password = ? WHERE session_token = ?', (new_password, token))
        return jsonify({"message": "Password updated successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@app.route('/api/jobs', methods=['GET'])
@token_required
def get_jobs(user_id):
    try:
        query = """
            SELECT job_id, company, position, location, salary, description, job_link
            FROM jobs
            WHERE user_id = ?
            ORDER BY created_at DESC
        """
        
        db = get_db()
        jobs = db.execute(query, (user_id,)).fetchall()
        
        jobs_list = [{
            'job_id': job['job_id'],
            'company': job['company'],
            'position': job['position'],
            'location': job['location'],
            'salary': job['salary'],
            'description': job['description'],
            'job_link': job['job_link']
        } for job in jobs]
        
        return jsonify({"jobs": jobs_list}), 200

    except Exception as e:
        print(f"Error getting jobs: {str(e)}")
        return jsonify({"error": "Failed to get jobs"}), 500

@app.route('/api/create_job', methods=['POST'])
@token_required
def create_job(user_id):
    try:
        job_id = str(uuid.uuid4())
        
        query = """
            INSERT INTO jobs (job_id, user_id, company, position, location, salary, description, job_link)
            VALUES (?, ?, '', '', '', '', '', '')
        """
        
        db = get_db()
        db.execute(query, (job_id, user_id))
        db.commit()
        
        return jsonify({"job_id": job_id}), 200

    except Exception as e:
        print(f"Error creating job: {str(e)}")
        return jsonify({"error": "Failed to create job"}), 500

@app.route('/api/save_job', methods=['PUT'])
@token_required
def save_job(user_id):
    try:
        data = request.json
        job_id = data.get('job_id')
        
        query = """
            UPDATE jobs 
            SET company = ?, position = ?, location = ?, salary = ?, description = ?, job_link = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE job_id = ? AND user_id = ?
        """
        
        db = get_db()
        db.execute(query, (
            data.get('company', ''),
            data.get('position', ''),
            data.get('location', ''),
            data.get('salary', ''),
            data.get('description', ''),
            data.get('job_link', ''),
            job_id,
            user_id
        ))
        db.commit()
        
        return jsonify({"message": "Job updated successfully"}), 200

    except Exception as e:
        print(f"Error saving job: {str(e)}")
        return jsonify({"error": "Failed to save job"}), 500

@app.route('/api/delete_job/<job_id>', methods=['DELETE'])
@token_required
def delete_job(user_id, job_id):
    try:
        job = query_db('SELECT * FROM jobs WHERE job_id = ? AND user_id = ?', (job_id, user_id), one=True)
        if not job:
            return jsonify({'success': False, 'message': 'Job not found'}), 404

        query_db('DELETE FROM jobs WHERE job_id = ? AND user_id = ?', (job_id, user_id))
        return jsonify({'success': True, 'message': 'Job deleted successfully'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 400

@app.route('/api/parse_job', methods=['POST'])
@token_required
def parse_job(user_id):
    try:
        data = request.json
        job_link = data.get('job_link')
        
        # Use the parser to extract job details
        parsed_data = p.get_parsed_jobs(job_link)
        if not parsed_data:
            return jsonify({"error": "Failed to parse job details"}), 400

        job_id = str(uuid.uuid4())
        
        query = """
            INSERT INTO jobs (job_id, user_id, company, position, location, salary, description, job_link)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """
        
        db = get_db()
        db.execute(query, (
            job_id, 
            user_id, 
            parsed_data.get('company', ''),
            parsed_data.get('position', ''),
            parsed_data.get('location', ''),
            parsed_data.get('salary', ''),
            parsed_data.get('description', ''),
            job_link
        ))
        db.commit()
        
        return jsonify({
            "job_id": job_id,
            "company": parsed_data.get('company', ''),
            "position": parsed_data.get('position', ''),
            "location": parsed_data.get('location', ''),
            "salary": parsed_data.get('salary', ''),
            "description": parsed_data.get('description', ''),
            "job_link": job_link
        }), 200

    except Exception as e:
        print(f"Error parsing job: {str(e)}")
        return jsonify({"error": "Failed to parse job"}), 500

@app.route('/api/networks', methods=['GET'])
@token_required
def get_networks(user_id):
    try:
        networks = query_db(
            'SELECT * FROM networks WHERE user_id = ? ORDER BY created_at DESC',
            (user_id,)
        )
        return jsonify({
            'networks': [
                {
                    'network_id': network['network_id'],
                    'name': network['name'],
                    'position': network['position'],
                    'company': network['company'],
                    'email': network['email'],
                    'linkedin': network['linkedin'],
                    'notes': network['notes'],
                    'created_at': network['created_at'],
                } for network in networks
            ]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/networks', methods=['POST'])
@token_required
def create_network(user_id):
    data = request.json
    network_id = str(uuid.uuid4())
    name = data.get('name')
    position = data.get('position', '')
    company = data.get('company', '')
    email = data.get('email', '')
    linkedin = data.get('linkedin', '')
    notes = data.get('notes', '')

    if not name:
        return jsonify({'error': 'Network name is required'}), 400

    try:
        query_db(
            'INSERT INTO networks (network_id, user_id, name, position, company, email, linkedin, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            (network_id, user_id, name, position, company, email, linkedin, notes)
        )
        return jsonify({
            'network_id': network_id,
            'name': name,
            'position': position,
            'company': company,
            'email': email,
            'linkedin': linkedin,
            'notes': notes
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/networks/<network_id>', methods=['PUT'])
@token_required
def update_network(user_id, network_id):
    data = request.json
    name = data.get('name')
    position = data.get('position', '')
    company = data.get('company', '')
    email = data.get('email', '')
    linkedin = data.get('linkedin', '')
    notes = data.get('notes', '')

    if not name:
        return jsonify({'error': 'Network name is required'}), 400

    try:
        query_db(
            'UPDATE networks SET name = ?, position = ?, company = ?, email = ?, linkedin = ?, notes = ? WHERE network_id = ? AND user_id = ?',
            (name, position, company, email, linkedin, notes, network_id, user_id)
        )
        return jsonify({'message': 'Network updated successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/networks/<network_id>', methods=['DELETE'])
@token_required
def delete_network(user_id, network_id):
    try:
        query_db('DELETE FROM networks WHERE network_id = ? AND user_id = ?', (network_id, user_id))
        return jsonify({'message': 'Network deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port = 8000)