# HerSphere Backend API

A comprehensive backend API for the HerSphere productivity and wellness application.

## Features

- **Authentication & Authorization**: JWT-based user authentication
- **Education Management**: NPTEL courses, assignments, research projects
- **Health Tracking**: Water intake, exercise, period tracking, typing practice
- **Analytics**: Comprehensive analytics for education and health data
- **File Upload**: Cloudinary integration for file storage
- **Database**: PostgreSQL with connection pooling

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL (Neon)
- **Authentication**: JWT
- **File Storage**: Cloudinary
- **Deployment**: Vercel

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT tokens
- `JWT_EXPIRES_IN`: JWT token expiration time
- `CLOUDINARY_CLOUD_NAME`: Cloudinary cloud name
- `CLOUDINARY_API_KEY`: Cloudinary API key
- `CLOUDINARY_API_SECRET`: Cloudinary API secret
- `PORT`: Server port (default: 3001)
- `NODE_ENV`: Environment (development/production)

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your values
```

3. Start development server:
```bash
npm run dev
```

The server will start on `http://localhost:3001`

## Deployment to Vercel

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Deploy:
```bash
vercel
```

4. Set environment variables in Vercel dashboard or via CLI:
```bash
vercel env add DATABASE_URL
vercel env add JWT_SECRET
vercel env add CLOUDINARY_CLOUD_NAME
vercel env add CLOUDINARY_API_KEY
vercel env add CLOUDINARY_API_SECRET
```

## API Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/signup` - User registration

### Education
- `GET /education/subjects` - Get user subjects
- `POST /education/nptel` - Add NPTEL course
- `GET /education/nptel` - Get NPTEL courses
- `POST /education/assignments` - Add assignment
- `GET /education/assignments` - Get assignments
- `GET /education/study-sleep-logs` - Get study/sleep logs
- `POST /education/study-sleep-logs` - Add study/sleep log

### Health
- `POST /health/upload` - Upload health data
- `GET /health/water` - Get water tracking data
- `POST /health/water` - Add water intake
- `GET /health/exercise` - Get exercise data
- `POST /health/exercise` - Add exercise session

### Analytics
- `GET /analytics/health` - Get health analytics
- `GET /analytics/education` - Get education analytics
- `GET /analytics/insights` - Get personalized insights

### Profile
- `GET /profile` - Get user profile
- `PUT /profile` - Update user profile
- `GET /profile/dashboard` - Get dashboard data

## Database Schema

The application uses PostgreSQL with the following main tables:
- `users` - User accounts
- `subjects` - Academic subjects
- `units` - Subject units
- `tasks` - Educational tasks
- `nptel_courses` - NPTEL course data
- `assignments` - User assignments
- `study_sleep_logs` - Study and sleep tracking
- `health_data` - Health tracking data
- `water_tracking` - Water intake logs
- `exercise_logs` - Exercise tracking

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the ISC License.