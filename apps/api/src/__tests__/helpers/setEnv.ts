// Runs before any module is loaded in each test file (jest setupFiles).
// Sets env vars so validateEnv() picks them up on its first (cached) call.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-minimum-32-characters-long!';
process.env.SUPER_ADMIN_EMAILS = 'superadmin@test.com';
process.env.ALLOW_PUBLIC_REGISTER = 'true';
process.env.PORT = '0';
process.env.BASE_URL = 'http://localhost:4200';
