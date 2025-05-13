import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get all regions with optional filtering and hierarchical structure
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getRegions = async (req, res, next) => {
  try {
    // Extract query parameters
    const { parentId, includeSubregions, includeCountries } = req.query;
    
    // Build base query
    const query = {
      where: {},
      orderBy: { name: 'asc' }
    };
    
    // Add parent filter if specified
    if (parentId !== undefined) {
      query.where.parentRegionId = parentId === null 
        ? null 
        : Number(parentId);
    }
    
    // Include subregions if requested
    if (includeSubregions === 'true') {
      query.include = {
        ...query.include,
        subRegions: true
      };
    }
    
    // Include countries if requested
    if (includeCountries === 'true') {
      query.include = {
        ...query.include,
        countries: {
          orderBy: { name: 'asc' }
        }
      };
    }
    
    // Execute query
    const regions = await prisma.region.findMany(query);
    
    // Structure response
    const result = regions.map(region => {
      const { subRegions, countries, ...data } = region;
      return {
        ...data,
        ...(subRegions && { subRegions }),
        ...(countries && { countries })
      };
    });
    
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single region by ID with all related data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getRegionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const region = await prisma.region.findUnique({
      where: { id: Number(id) },
      include: {
        parentRegion: true,
        subRegions: {
          orderBy: { name: 'asc' }
        },
        countries: {
          orderBy: { name: 'asc' }
        }
      }
    });
    
    if (!region) {
      return res.status(404).json({ message: `Region with ID ${id} not found` });
    }
    
    res.json(region);
  } catch (error) {
    next(error);
  }
};

/**
 * Get all countries with optional region filtering
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getCountries = async (req, res, next) => {
  try {
    // Extract query parameters
    const { regionId, search } = req.query;
    
    // Build base query
    const query = {
      where: {},
      orderBy: { name: 'asc' },
      include: {
        region: true
      }
    };
    
    // Add region filter if specified
    if (regionId) {
      query.where.regionId = Number(regionId);
    }
    
    // Add search filter if specified
    if (search) {
      query.where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    // Execute query
    const countries = await prisma.country.findMany(query);
    
    res.json(countries);
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single country by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getCountryById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const country = await prisma.country.findUnique({
      where: { id: Number(id) },
      include: {
        region: true
      }
    });
    
    if (!country) {
      return res.status(404).json({ message: `Country with ID ${id} not found` });
    }
    
    res.json(country);
  } catch (error) {
    next(error);
  }
};

/**
 * Get country by code (ISO code)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getCountryByCode = async (req, res, next) => {
  try {
    const { code } = req.params;
    
    const country = await prisma.country.findFirst({
      where: { 
        code: { 
          equals: code.toUpperCase(),
          mode: 'insensitive'
        } 
      },
      include: {
        region: true
      }
    });
    
    if (!country) {
      return res.status(404).json({ message: `Country with code ${code} not found` });
    }
    
    res.json(country);
  } catch (error) {
    next(error);
  }
}; 