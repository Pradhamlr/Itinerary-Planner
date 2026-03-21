const requiredVars = ['MONGO_URI', 'JWT_SECRET']
const optionalVars = ['ML_SERVICE_URL', 'GOOGLE_MAPS_API_KEY', 'EMAIL_USER', 'EMAIL_PASS']

function validateEnv() {
  const missingRequired = requiredVars.filter((name) => !process.env[name])
  if (missingRequired.length > 0) {
    throw new Error(`Missing required environment variables: ${missingRequired.join(', ')}`)
  }

  const missingOptional = optionalVars.filter((name) => !process.env[name])
  if (missingOptional.length > 0) {
    console.warn(`[config] Optional environment variables not set: ${missingOptional.join(', ')}`)
  }
}

module.exports = validateEnv
