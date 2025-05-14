# Drona

A Flask-based web application for job management and professional networking with secure authentication.

## Features

- 🔐 **User Authentication**
  - Secure signup/login with session tokens
  - Profile management
  
- 💼 **Job Management**
  - Create, read, update, and delete jobs
  - Job parsing and saving capabilities
  
- 🌐 **Network Management**
  - Create and manage professional networks
  - Network updates and modifications

## Quick Start

1. Clone and install dependencies:
```bash
git clone [repository-url]
cd drona
pip install -r requirements.txt
```

2. Run the application:
```bash
python app.py
```

The database will be automatically initialized on first run.

## Tech Stack

- Backend: Python/Flask
- Database: SQLite3
- Authentication: JWT
- Frontend: Single Page Application

## API Routes

### Auth
- `POST /api/signup` - Create account
- `POST /api/login` - Login
- `POST /api/profile/username` - Update username
- `POST /api/profile/password` - Update password

### Jobs
- `GET /api/jobs` - List jobs
- `POST /api/create_job` - Create job
- `PUT /api/save_job` - Update job
- `DELETE /api/delete_job/<job_id>` - Delete job
- `POST /api/parse_job` - Parse job info

### Networks
- `GET /api/networks` - List networks
- `POST /api/networks` - Create network
- `PUT /api/networks/<network_id>` - Update network
- `DELETE /api/networks/<network_id>` - Delete network

## Project Structure

drona/
├── static/ # Frontend files
├── db/ # Database & migrations
├── app.py # Main application
├── parser.py # Parsing utilities
└── requirements.txt # Dependencies


## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
