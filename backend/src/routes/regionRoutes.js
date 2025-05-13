import express from 'express';
import { 
  getRegions, 
  getRegionById, 
  getCountries, 
  getCountryById, 
  getCountryByCode 
} from '../controllers/regionController.js';

const router = express.Router();

/**
 * @swagger
 * /api/regions:
 *   get:
 *     summary: Get all regions
 *     description: Retrieve all regions with optional filtering by parent region and inclusion of subregions/countries
 *     parameters:
 *       - in: query
 *         name: parentId
 *         schema:
 *           type: integer
 *         description: Filter regions by parent region ID (use 'null' for top-level regions)
 *       - in: query
 *         name: includeSubregions
 *         schema:
 *           type: boolean
 *         description: Include subregions in the response
 *       - in: query
 *         name: includeCountries
 *         schema:
 *           type: boolean
 *         description: Include countries in the response
 */
router.get('/regions', getRegions);

/**
 * @swagger
 * /api/regions/{id}:
 *   get:
 *     summary: Get region by ID
 *     description: Retrieve a single region by its ID with parent region, subregions, and countries
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Region ID
 */
router.get('/regions/:id', getRegionById);

/**
 * @swagger
 * /api/countries:
 *   get:
 *     summary: Get all countries
 *     description: Retrieve all countries with optional filtering by region and search term
 *     parameters:
 *       - in: query
 *         name: regionId
 *         schema:
 *           type: integer
 *         description: Filter countries by region ID
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for country name or code
 */
router.get('/countries', getCountries);

/**
 * @swagger
 * /api/countries/code/{code}:
 *   get:
 *     summary: Get country by ISO code
 *     description: Retrieve a single country by its ISO country code with associated region
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: ISO country code (2-letter)
 */
router.get('/countries/code/:code', getCountryByCode);

/**
 * @swagger
 * /api/countries/{id}:
 *   get:
 *     summary: Get country by ID
 *     description: Retrieve a single country by its ID with associated region
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Country ID
 */
router.get('/countries/:id', getCountryById);

export default router; 