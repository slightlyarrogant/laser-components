import { PrismaClient, EnrichmentJobStatus, Prisma } from '@prisma/client';
import { LeadService } from './LeadService.js';

const prisma = new PrismaClient();

/**
 * Service for managing lead data enrichment 
 * Implements Task 6.5: Develop Batch Processing System for Lead Enrichment
 */
export class LeadEnrichmentService {
  constructor(config = {}) {
    this.leadService = new LeadService();
    
    // API rate limits - default values, can be overridden in config
    this.rateLimits = config.rateLimits || {
      requestsPerMinute: 60,  // Default: 60 requests per minute 
      maxConcurrentRequests: 5, // Default: 5 concurrent requests
      retryDelayMs: 5000,     // Default: 5 seconds before retrying after rate limit
    };
    
    // Enrichment sources configuration
    this.enrichmentSources = config.enrichmentSources || [
      {
        name: 'clearbit',
        enabled: true,
        weight: 3,  // Higher weight = more throttling
        url: 'https://company.clearbit.com/v2/companies/find',
        headers: {
          'Authorization': `Bearer ${process.env.CLEARBIT_API_KEY || 'demo'}`,
        },
      },
      {
        name: 'hunter',
        enabled: true,
        weight: 2,
        url: 'https://api.hunter.io/v2/domain-search',
        apiKey: process.env.HUNTER_API_KEY || 'demo',
      },
      {
        name: 'opencorporates',
        enabled: true,
        weight: 1,
        url: 'https://api.opencorporates.com/v0.4/companies/search',
        apiKey: process.env.OPENCORPORATES_API_KEY || 'demo',
      }
    ];
    
    // Request queue
    this.requestQueue = [];
    this.activeRequests = 0;
    this.processingBatch = false;
    
    // Start the queue processor if configured to do so
    if (config.autoStartProcessor !== false) {
      this.startQueueProcessor();
    }
  }
  
  /**
   * Start the queue processor loop
   * @returns {void}
   */
  startQueueProcessor() {
    // Only start if not already processing
    if (this.processingInterval) {
      return;
    }
    
    // Process queue every second
    this.processingInterval = setInterval(() => {
      this.processNextBatchInQueue();
    }, 1000);
    
    console.log('Enrichment queue processor started');
  }
  
  /**
   * Stop the queue processor
   * @returns {void}
   */
  stopQueueProcessor() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      console.log('Enrichment queue processor stopped');
    }
  }
  
  /**
   * Create a new enrichment batch job
   * @param {Array<number>} leadIds - Array of lead IDs to enrich
   * @param {Object} options - Batch options
   * @param {string} [options.name] - Name for the batch
   * @param {string} [options.description] - Description of the batch
   * @param {string} [options.createdBy] - User who created the batch
   * @param {Object} [options.metadata] - Additional metadata as JSON
   * @returns {Promise<Object>} - Created batch
   */
  async createBatch(leadIds, options = {}) {
    // Validate lead IDs
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      throw new Error('At least one lead ID is required');
    }
    
    // Start a transaction
    return prisma.$transaction(async (tx) => {
      // Create the batch
      const batch = await tx.enrichmentBatch.create({
        data: {
          name: options.name || `Enrichment Batch ${new Date().toISOString()}`,
          description: options.description,
          createdBy: options.createdBy || 'system',
          totalJobs: leadIds.length,
          status: 'PENDING',
          metadata: options.metadata ? JSON.stringify(options.metadata) : null,
        }
      });
      
      // Create individual jobs for each lead
      const jobPromises = leadIds.map(leadId => 
        tx.enrichmentJob.create({
          data: {
            batchId: batch.id,
            leadId: Number(leadId),
            status: EnrichmentJobStatus.PENDING,
          }
        })
      );
      
      await Promise.all(jobPromises);
      
      return batch;
    });
  }
  
  /**
   * Get a batch by ID with detailed stats
   * @param {number} batchId - Batch ID to retrieve
   * @returns {Promise<Object>} - Batch with job stats
   */
  async getBatchById(batchId) {
    const batch = await prisma.enrichmentBatch.findUnique({
      where: { id: Number(batchId) },
      include: {
        jobs: {
          select: {
            id: true,
            leadId: true,
            status: true,
            attempts: true,
            completedAt: true,
            error: true,
          }
        }
      }
    });
    
    if (!batch) {
      throw new Error(`Batch with ID ${batchId} not found`);
    }
    
    // Calculate stats
    const stats = {
      total: batch.totalJobs,
      completed: batch.jobs.filter(j => j.status === EnrichmentJobStatus.COMPLETED).length,
      failed: batch.jobs.filter(j => j.status === EnrichmentJobStatus.FAILED).length,
      pending: batch.jobs.filter(j => j.status === EnrichmentJobStatus.PENDING).length,
      processing: batch.jobs.filter(j => j.status === EnrichmentJobStatus.PROCESSING).length,
      rateLimited: batch.jobs.filter(j => j.status === EnrichmentJobStatus.RATE_LIMITED).length,
    };
    
    return {
      ...batch,
      stats
    };
  }
  
  /**
   * Get all batches with basic stats
   * @param {Object} options - Query options
   * @param {number} [options.page=1] - Page number
   * @param {number} [options.limit=20] - Items per page
   * @param {string} [options.status] - Filter by status
   * @returns {Promise<Object>} - Batches with pagination metadata
   */
  async getBatches(options = {}) {
    const {
      page = 1,
      limit = 20,
      status
    } = options;
    
    // Build where clause
    const where = {};
    if (status) {
      where.status = status;
    }
    
    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit);
    
    // Get batches with counts
    const [batches, totalCount] = await Promise.all([
      prisma.enrichmentBatch.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { jobs: true }
          }
        }
      }),
      prisma.enrichmentBatch.count({ where })
    ]);
    
    return {
      data: batches,
      pagination: {
        total: totalCount,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(totalCount / Number(limit))
      }
    };
  }
  
  /**
   * Process the next batch in the queue
   * @returns {Promise<void>}
   * @private
   */
  async processNextBatchInQueue() {
    // Skip if we're at max capacity
    if (this.activeRequests >= this.rateLimits.maxConcurrentRequests) {
      return;
    }
    
    // Find the next batch that is currently marked as processing
    const nextBatch = await prisma.enrichmentBatch.findFirst({
      where: {
        status: 'PROCESSING',
        // We'll check the job count condition after finding the batch
      },
      orderBy: {
        startedAt: 'asc'
      }
    });

    if (!nextBatch) {
      // Check if there are pending batches that need to be started
      const pendingBatch = await prisma.enrichmentBatch.findFirst({
        where: {
          status: 'PENDING'
        },
        orderBy: {
          createdAt: 'asc'
        }
      });
      
      if (pendingBatch) {
        // Start the batch
        await prisma.enrichmentBatch.update({
          where: { id: pendingBatch.id },
          data: {
            status: 'PROCESSING',
            startedAt: new Date()
          }
        });
        
        console.log(`Started processing batch ${pendingBatch.id}`);
      }
      
      return; // No processing or pending batches found
    }

    // NOW check if this batch actually needs more processing
    if (nextBatch.completedJobs >= nextBatch.totalJobs) {
      // This batch is actually done, mark it completed and return
      await prisma.enrichmentBatch.update({
        where: { id: nextBatch.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date()
        }
      });
      console.log(`Batch ${nextBatch.id} completed (found during queue processing)`);
      return; // Move to the next cycle
    }

    // If the batch needs more processing, get the next pending job
    const nextJob = await prisma.enrichmentJob.findFirst({
      where: {
        batchId: nextBatch.id,
        status: EnrichmentJobStatus.PENDING
      },
      orderBy: {
        createdAt: 'asc'
      },
      include: {
        lead: true
      }
    });
    
    if (!nextJob) {
      // Check if all jobs are done
      const jobStatuses = await prisma.enrichmentJob.groupBy({
        by: ['status'],
        where: {
          batchId: nextBatch.id
        },
        _count: true
      });
      
      const pendingCount = jobStatuses.find(s => 
        s.status === EnrichmentJobStatus.PENDING || 
        s.status === EnrichmentJobStatus.PROCESSING
      );
      
      if (!pendingCount) {
        // All jobs are either completed or failed, update batch status
        await prisma.enrichmentBatch.update({
          where: { id: nextBatch.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date()
          }
        });
        
        console.log(`Batch ${nextBatch.id} completed`);
      }
      
      return;
    }
    
    // Start processing this job
    this.processEnrichmentJob(nextJob);
  }
  
  /**
   * Process an individual enrichment job
   * @param {Object} job - Job to process
   * @returns {Promise<void>}
   * @private
   */
  async processEnrichmentJob(job) {
    // Increment active requests
    this.activeRequests++;
    
    try {
      // Mark job as processing
      await prisma.enrichmentJob.update({
        where: { id: job.id },
        data: {
          status: EnrichmentJobStatus.PROCESSING,
          attempts: { increment: 1 },
          lastAttemptAt: new Date()
        }
      });
      
      // Perform enrichment
      const enrichmentData = await this.enrichLeadData(job.lead);
      
      // Mark job as completed
      await prisma.enrichmentJob.update({
        where: { id: job.id },
        data: {
          status: EnrichmentJobStatus.COMPLETED,
          completedAt: new Date(),
          result: JSON.stringify(enrichmentData)
        }
      });
      
      // Update batch stats
      await prisma.enrichmentBatch.update({
        where: { id: job.batchId },
        data: {
          completedJobs: { increment: 1 }
        }
      });
      
      // Update lead with enriched data
      await prisma.lead.update({
        where: { id: job.leadId },
        data: {
          ...enrichmentData,
          lastEnriched: new Date()
        }
      });
    } catch (error) {
      console.error(`Error processing job ${job.id}:`, error);
      
      // Check if it's a rate limit error
      const isRateLimit = error.message.includes('rate limit') || 
                       error.message.includes('too many requests');
      
      // Mark job as failed or rate limited
      await prisma.enrichmentJob.update({
        where: { id: job.id },
        data: {
          status: isRateLimit ? EnrichmentJobStatus.RATE_LIMITED : EnrichmentJobStatus.FAILED,
          error: error.message,
          // If rate limited and under max attempts, set back to pending
          ...(isRateLimit && job.attempts < job.maxAttempts ? 
              { status: EnrichmentJobStatus.PENDING } : {})
        }
      });
      
      // If it was a permanent failure, update batch stats
      if (!isRateLimit || job.attempts >= job.maxAttempts) {
        await prisma.enrichmentBatch.update({
          where: { id: job.batchId },
          data: {
            failedJobs: { increment: 1 }
          }
        });
      }
      
      // If rate limited, add delay before next request
      if (isRateLimit) {
        await new Promise(resolve => setTimeout(resolve, this.rateLimits.retryDelayMs));
      }
    } finally {
      // Decrement active requests
      this.activeRequests--;
    }
  }
  
  /**
   * Enrich a lead with data from external sources
   * @param {Object} lead - Lead to enrich
   * @returns {Promise<Object>} - Enriched data
   * @private
   */
  async enrichLeadData(lead) {
    // Check which data is missing and needs enrichment
    const needsEnrichment = {
      industry: !lead.industry,
      employeeCount: lead.employeeCount === null || lead.employeeCount === undefined,
      annualRevenue: lead.annualRevenue === null || lead.annualRevenue === undefined,
      foundedYear: !lead.foundedYear,
      website: !lead.website,
      linkedInUrl: !lead.linkedInUrl,
      description: !lead.description
    };
    
    // If everything is already enriched, return the current data
    if (!Object.values(needsEnrichment).some(Boolean)) {
      return {};
    }
    
    // Mock implementation - in a real system, this would call actual APIs
    // Simulate API requests to external services with rate limiting awareness
    await this.simulateExternalAPIRequest();
    
    // Mock enriched data - would come from actual API responses
    const enrichedData = {};
    
    if (needsEnrichment.industry) {
      enrichedData.industry = this.getMockIndustry(lead.name);
    }
    
    if (needsEnrichment.employeeCount) {
      enrichedData.employeeCount = this.getMockEmployeeCount();
    }
    
    if (needsEnrichment.annualRevenue) {
      enrichedData.annualRevenue = this.getMockAnnualRevenue();
    }
    
    if (needsEnrichment.foundedYear) {
      enrichedData.foundedYear = this.getMockFoundedYear();
    }
    
    if (needsEnrichment.website && lead.name) {
      enrichedData.website = this.getMockWebsite(lead.name);
    }
    
    if (needsEnrichment.linkedInUrl && lead.name) {
      enrichedData.linkedInUrl = this.getMockLinkedInUrl(lead.name);
    }
    
    if (needsEnrichment.description) {
      enrichedData.description = this.getMockDescription(lead.name, enrichedData.industry || lead.industry);
    }
    
    return enrichedData;
  }
  
  /**
   * Simulate an external API request with rate limiting
   * @returns {Promise<void>}
   * @private
   */
  async simulateExternalAPIRequest() {
    // Add random delay to simulate API request (100-500ms)
    const requestTime = 100 + Math.random() * 400;
    await new Promise(resolve => setTimeout(resolve, requestTime));
    
    // Randomly throw rate limit errors to test recovery (~10% chance)
    if (Math.random() < 0.1) {
      throw new Error('API rate limit exceeded. Try again later.');
    }
  }
  
  // Mock data generators for demonstration purposes
  // In a real implementation, these would be replaced by actual API calls
  
  getMockIndustry(companyName) {
    const industries = [
      'Technology', 'Manufacturing', 'Healthcare', 'Financial Services',
      'Retail', 'Education', 'Energy', 'Transportation', 'Telecommunications',
      'Construction', 'Agriculture', 'Entertainment', 'Hospitality',
      'Pharmaceuticals', 'Aerospace', 'Automotive', 'Chemicals',
      'Electronics Manufacturing', 'Research & Development'
    ];
    return industries[Math.floor(Math.random() * industries.length)];
  }
  
  getMockEmployeeCount() {
    const sizes = [10, 25, 50, 100, 250, 500, 1000, 5000, 10000, 50000];
    return sizes[Math.floor(Math.random() * sizes.length)];
  }
  
  getMockAnnualRevenue() {
    const revenues = [500000, 1000000, 5000000, 10000000, 50000000, 100000000, 500000000, 1000000000];
    return revenues[Math.floor(Math.random() * revenues.length)];
  }
  
  getMockFoundedYear() {
    const currentYear = new Date().getFullYear();
    return currentYear - Math.floor(Math.random() * 80) - 5; // Between 5 and 85 years old
  }
  
  getMockWebsite(companyName) {
    // Convert company name to a domain-friendly format
    const domain = companyName.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
    return domain;
  }
  
  getMockLinkedInUrl(companyName) {
    // Convert company name to a URL-friendly format
    const formattedName = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `linkedin.com/company/${formattedName}`;
  }
  
  getMockDescription(companyName, industry) {
    if (!industry) {
      industry = this.getMockIndustry(companyName);
    }
    
    return `${companyName} is a leading provider of ${industry.toLowerCase()} solutions for businesses of all sizes. With a focus on innovation and customer success, the company has grown to become a trusted partner for organizations seeking cutting-edge ${industry.toLowerCase()} products and services.`;
  }
  
  /**
   * Manually restart a failed job
   * @param {number} jobId - Job ID to restart
   * @returns {Promise<Object>} - Updated job
   */
  async restartJob(jobId) {
    const job = await prisma.enrichmentJob.findUnique({
      where: { id: Number(jobId) }
    });
    
    if (!job) {
      throw new Error(`Job with ID ${jobId} not found`);
    }
    
    // Can only restart failed or rate limited jobs
    if (job.status !== EnrichmentJobStatus.FAILED && job.status !== EnrichmentJobStatus.RATE_LIMITED) {
      throw new Error(`Job ${jobId} cannot be restarted because it is ${job.status}`);
    }
    
    // Reset job status
    return prisma.enrichmentJob.update({
      where: { id: Number(jobId) },
      data: {
        status: EnrichmentJobStatus.PENDING,
        error: null
      }
    });
  }
  
  /**
   * Cancel a batch job
   * @param {number} batchId - Batch ID to cancel
   * @returns {Promise<Object>} - Updated batch
   */
  async cancelBatch(batchId) {
    const batch = await prisma.enrichmentBatch.findUnique({
      where: { id: Number(batchId) }
    });
    
    if (!batch) {
      throw new Error(`Batch with ID ${batchId} not found`);
    }
    
    // Can only cancel pending or processing batches
    if (batch.status !== 'PENDING' && batch.status !== 'PROCESSING') {
      throw new Error(`Batch ${batchId} cannot be canceled because it is ${batch.status}`);
    }
    
    // Update batch status
    await prisma.enrichmentBatch.update({
      where: { id: Number(batchId) },
      data: {
        status: 'FAILED',
        completedAt: new Date()
      }
    });
    
    // Update pending jobs to failed
    await prisma.enrichmentJob.updateMany({
      where: {
        batchId: Number(batchId),
        status: {
          in: [EnrichmentJobStatus.PENDING, EnrichmentJobStatus.PROCESSING]
        }
      },
      data: {
        status: EnrichmentJobStatus.FAILED,
        error: 'Batch was canceled'
      }
    });
    
    return this.getBatchById(batchId);
  }
} 