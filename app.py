import string
import random
import sqlite3
from flask import Flask, g, request, jsonify, send_from_directory
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
import uuid
from typing import Optional, Dict, Any
import os

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

    user = query_db('SELECT * FROM users WHERE username = ?', (username,), one=True)
    
    if user and check_password_hash(user['password'], password):
        # Generate new session token
        session_token = str(uuid.uuid4())
        query_db('UPDATE users SET session_token = ? WHERE id = ?', (session_token, user['id']))
        
        return jsonify({
            'token': session_token, 
            'user_id': user['id']
        }), 200
    
    return jsonify({"error": "Invalid credentials"}), 401

# Gives a list of channels and the unread counts
@app.route('/api/channels', methods=['GET'])
@token_required
def get_channels(user_id):
    channels = query_db("""
        SELECT 
            c.id AS channel_id, 
            c.name AS channel_name, 
            COUNT(m.id) AS unread_count
        FROM channels c
        LEFT JOIN messages m 
            ON c.id = m.channel_id
            AND m.created_at > COALESCE(
                (SELECT last_seen_timestamp
                 FROM user_channel_last_seen
                 WHERE user_id = ? AND channel_id = c.id),
                '1970-01-01 00:00:00'
            )
            AND m.id NOT IN (
                SELECT reply_message_id 
                FROM message_replies 
                )
        GROUP BY c.id
    """, (user_id,))  

    # Return the list of channels with their unread count
    return jsonify([{
        'id': channel['channel_id'],
        'name': channel['channel_name'],
        'unread_count': channel['unread_count']
    } for channel in channels]), 200

# Add a new channel
@app.route('/api/channels', methods=['POST'])
@token_required
def create_channel(user_id):
    data = request.json
    channel_name = data.get('name')

    # Check if channel name exists
    existing_channel = query_db('SELECT * FROM channels WHERE name = ?', (channel_name,), one=True)
    if existing_channel:
        return jsonify({"error": "Channel name already exists"}), 400

    channel = query_db(
        'INSERT INTO channels (name, created_by) VALUES (?, ?) RETURNING *', 
        (channel_name, user_id), 
        one=True
    )

    return jsonify(dict(channel)), 201


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

# Get messages and update last seen in the last-seen table
@app.route('/api/messages/room/<int:room_id>', methods=['GET'])
@token_required
def get_messages(user_id, room_id):
    # Add support for fetching messages after a specific ID
    after_id = request.args.get('after', type=int)

    # Update last seen timestamp
    update_last_seen = '''
        INSERT INTO user_channel_last_seen (user_id, channel_id)
        VALUES (?, ?)
        ON CONFLICT(user_id, channel_id) 
        DO UPDATE SET last_seen_timestamp = CURRENT_TIMESTAMP;
    '''
    query_db(update_last_seen, (user_id, room_id))

    # Base query to fetch messages
    base_query = '''
        SELECT 
            m.id, 
            u.username AS author, 
            m.content,
            (SELECT COUNT(*) 
             FROM message_replies 
             WHERE original_message_id = m.id) AS reply_count
        FROM messages AS m 
        JOIN users AS u ON u.id = m.user_id 
        WHERE m.channel_id = ? 
        AND m.id NOT IN (
            SELECT reply_message_id 
            FROM message_replies
        )
    '''

    # Add condition to fetch only messages after a specific ID
    if after_id:
        base_query += ' AND m.id > ?'
        params = (room_id, after_id)
    else:
        params = (room_id,)

    messages = query_db(base_query, params)
    
    messages_list = [{
        'id': message['id'],
        'author': message['author'], 
        'body': message['content'],
        'replies': message['reply_count']
    } for message in messages] if messages else []
    
    return jsonify(messages_list)

# Get message details incase the user directly opens a thread 
@app.route('/api/messages/<int:message_id>', methods=['GET'])
@token_required
def get_message_details(user_id, message_id):
    message = query_db("""
        SELECT m.content AS message_body, u.username AS author
        FROM messages m
        JOIN users u ON m.user_id = u.id
        WHERE m.id = ?
    """, (message_id,), one=True)
    
    if message:
        return jsonify({
            'message_body': message['message_body'],
            'author': message['author']
        })
    else:
        return jsonify({'error': 'Message not found'}), 404

# Get message replies
@app.route('/api/messages/<int:message_id>/replies', methods=['GET'])
@token_required
def get_replies(user_id, message_id):
    replies = query_db("""
        SELECT m.id AS reply_id, m.user_id, u.username AS author, m.content AS reply_content, m.created_at AS reply_date
        FROM message_replies mr
        JOIN messages m ON mr.reply_message_id = m.id
        JOIN users u ON m.user_id = u.id
        WHERE mr.original_message_id = ?
        ORDER BY m.created_at ASC
    """, (message_id,))
    replies = [{'id':reply['reply_id'],'author': reply['author'], 'reply_content': reply['reply_content'], 'reply_date':reply['reply_date']} for reply in replies] if replies else []
    return jsonify(replies),200

# @app.route('/api/rooms/<int:room_id>', methods=['GET'])
# @token_required
# def get_room(user_id, room_id):
#     room = query_db('SELECT * FROM rooms WHERE id = ?', (room_id,), one=True)
#     if not room:
#         return jsonify({"error": "Room not found"}), 404
#     response = {'id': room['id'], 'name': room['name']}
#     return jsonify(response), 200

# @app.route('/api/allrooms/', methods=['GET'])
# @token_required
# def all_rooms(user_id):
#     rooms = query_db('SELECT * FROM rooms')
#     dict_rows = [dict(row) for row in rooms]
#     return jsonify(dict_rows), 200

#post a message to a channel(channel and room interchangably used here)
@app.route('/api/room/messages/post', methods=['POST'])
@token_required
def post_message(user_id):
    data = request.json
    body = data.get('message_body')
    room_id = data.get('room_id')

    if not body or not room_id:
        return jsonify({"error": "message_body and room_id are required"}), 400

    query_db('INSERT INTO messages (user_id, channel_id, content) VALUES (?, ?, ?)', (user_id, room_id, body))
    return jsonify({"message": "success"}), 200

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
    
#get replies to a message
@app.route('/api/messages/<int:message_id>/replies', methods=['POST'])
@token_required
def post_reply(user_id, message_id):
    
    data = request.json
    reply_content = data.get('content')

    # Validate reply content
    if not reply_content:
        return jsonify({'error': 'Content cannot be empty'}), 400

    # Fetch channel_id and original message details
    original_message = query_db("""
        SELECT m.channel_id, u.username AS original_author, m.content AS original_content
        FROM messages m
        JOIN users u ON m.user_id = u.id
        WHERE m.id = ?
    """, (message_id,), one=True)
    print("original message", original_message)
    if not original_message:
        return jsonify({'error': 'Original message not found'}), 404

    channel_id = original_message['channel_id']
    original_author = original_message['original_author']
    original_content = original_message['original_content']

    
    reply = query_db("""
        INSERT INTO messages (channel_id, user_id, content)
        VALUES (?, ?, ?) returning id
    """, (channel_id, user_id, reply_content), one=True)

    reply_id = reply['id']
    print("reply", reply_id)
    query_db("""
        INSERT INTO message_replies (original_message_id, reply_message_id)
        VALUES (?, ?)
    """, (message_id, reply_id), one=True)

    return jsonify({
        'message': 'Reply posted successfully',
        'reply_id': reply_id,
        'original_message': {
            'author': original_author,
            'content': original_content
        }
    }), 201

#post a reaction
@app.route('/api/messages/<int:message_id>/reactions', methods=['POST'])
@token_required
def add_reaction(user_id, message_id):
    data = request.json
    reaction = data.get('reaction')

    if not reaction:
        return jsonify({"error": "Reaction is required"}), 400

    # Check if the reaction already exists for the user
    existing_reaction = query_db(
        'SELECT * FROM message_reactions WHERE message_id = ? AND user_id = ? AND reaction = ?',
        (message_id, user_id, reaction), 
        one=True
    )

    if existing_reaction:
        # Remove reaction if it exists
        query_db('DELETE FROM message_reactions WHERE id = ?', (existing_reaction['id'],))
        return jsonify({"message": "Reaction removed"}), 200
    else:
        # Add reaction
        query_db(
            'INSERT INTO message_reactions (message_id, user_id, reaction) VALUES (?, ?, ?)',
            (message_id, user_id, reaction)
        )
        return jsonify({"message": "Reaction added"}), 201

@app.route('/api/channel/name/<int:channel_id>',methods = ["GET"])
@token_required
def get_room_name(user_id,channel_id):
    name = query_db('SELECT name FROM channels WHERE id = ?',(channel_id,),one= True)
    return jsonify({"channel_name" : name['name']})

#get message reactions
@app.route('/api/messages/<int:message_id>/reactions', methods=['GET'])
@token_required
def get_reactions(user_id, message_id):
    reactions = query_db(
        '''
        SELECT reaction, GROUP_CONCAT(users.username) AS users
        FROM message_reactions
        JOIN users ON users.id = message_reactions.user_id
        WHERE message_id = ?
        GROUP BY reaction
        ''',
        (message_id,)
    )
    if reactions:
        return jsonify({row['reaction']: row['users'].split(',') for row in reactions}), 200
    else:
        return jsonify({}), 200

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
    

# Not using for this project
# @app.route('/api/rooms/new', methods=['POST'])
# @token_required
# def create_room(user_id):
#     name = "Unnamed Room " + ''.join(random.choices(string.digits, k=6))
#     room = query_db('INSERT INTO rooms (name) VALUES (?) RETURNING id, name', [name], one=True)
#     return jsonify({'id': room["id"], 'name': room['name']})

if __name__ == '__main__':
    app.run(debug=True, port = 8000)