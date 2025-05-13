import express from 'express'
import dotenv from 'dotenv'
import cookieParser from 'cookie-parser' // Import cookie-parser
import cors from 'cors' // Import cors
import authRoutes from './routes/authRoutes.js' // Import auth routes
import productRoutes from './routes/productRoutes.js' // Import product routes
import applicationRoutes from './routes/applicationRoutes.js' // Import application routes
import organizationRoutes from './routes/organizationRoutes.js' // Import organization routes
import cacheRoutes from './routes/cacheRoutes.js' // Import cache routes
import leadRoutes from './routes/leadRoutes.js' // Import lead routes
import leadDiscoveryRoutes from './routes/leadDiscoveryRoutes.js' // Import lead discovery routes
import enrichmentRoutes from './routes/enrichmentRoutes.js' // Import enrichment routes
import regionRoutes from './routes/regionRoutes.js' // Import region routes
import noteRoutes from './routes/noteRoutes.js' // Import note routes
import tagPresetRoutes from './routes/tagPresetRoutes.js' // Import tag preset routes
import userRoutes from './routes/userRoutes.js' // Import user routes
import analyticsRoutes from './routes/analyticsRoutes.js' // Import analytics routes
import industrialResearchRoutes from './routes/industrialResearchRoutes.js' // Import industrial research routes
import { errorHandler, notFound } from './middleware/errorMiddleware.js' // Import error handlers

// Load environment variables from .env file
dotenv.config()

const app = express()

// --- Middleware ---
// Temporarily allow all origins for debugging CORS
app.use(cors({ 
  origin: '*', // Allow ANY origin (DEBUGGING ONLY)
  credentials: true 
})); 

app.use(express.json()) // Parse JSON bodies
app.use(cookieParser()) // Parse cookies

// --- Routes --- 
// Mount auth routes under /api/auth
app.use('/api/auth', authRoutes) 
// Mount product/category/subcategory routes under /api
app.use('/api', productRoutes) 
app.use('/api/applications', applicationRoutes) // Mount application routes
app.use('/api/organizations', organizationRoutes) // Mount organization routes
app.use('/api/cache', cacheRoutes) // Mount cache routes
app.use('/api/leads', leadRoutes) // Mount lead routes
app.use('/api/lead-discovery', leadDiscoveryRoutes) // Mount lead discovery routes
app.use('/api/enrichment', enrichmentRoutes) // Mount enrichment routes
app.use('/api', regionRoutes) // Mount region routes
app.use('/api', noteRoutes) // Mount note routes
app.use('/api/tag-presets', tagPresetRoutes) // Mount tag preset routes
app.use('/api/users', userRoutes) // Mount user routes
app.use('/api/analytics', analyticsRoutes) // Mount analytics routes
app.use('/api/research', industrialResearchRoutes) // Mount industrial research routes

// Basic route for testing (can be removed later)
app.get('/', (req, res) => {
  res.send('Hello from the backend!')
})

// Add other routes (leads, etc.) here later

// --- Error Handling Middleware ---
app.use(notFound)      // Handle 404s first
app.use(errorHandler)  // Then handle all other errors

// Define the port
const PORT = process.env.BACKEND_PORT || 3001 // Default to 3001 if not set in .env

// Start the server
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`)
}) 