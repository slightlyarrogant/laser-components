import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import asyncHandler from 'express-async-handler'; // Import for handling async errors
import { createObjectCsvStringifier } from 'csv-writer'; // Import CSV writer

// TODO: Implement CRUD operations for IndustrialApplicationResearch

// @desc    Create a new research item
// @route   POST /api/research
// @access  Private (TODO: Add auth middleware)
export const createResearch = asyncHandler(async (req, res) => {
  const { 
    applicationName,
    industrySector,
    useCaseDescription,
    marketPotential,
    technicalRequirements,
    competitiveLandscape,
    subcategoryId, // Optional
    productId,     // Optional
    // createdByUserId should ideally come from authenticated user context
    // For now, let's assume it's passed in the body for simplicity
    createdByUserId 
  } = req.body;

  // Basic validation
  if (!applicationName || !createdByUserId) {
    res.status(400);
    throw new Error('Application name and createdByUserId are required');
  }

  // TODO: Add more robust validation (e.g., check if user exists)

  try {
    const newResearch = await prisma.industrialApplicationResearch.create({
      data: {
        applicationName,
        industrySector,
        useCaseDescription,
        marketPotential,
        technicalRequirements,
        competitiveLandscape,
        createdByUserId: parseInt(createdByUserId, 10), // Ensure it's an integer
        subcategoryId: subcategoryId ? parseInt(subcategoryId, 10) : undefined,
        productId: productId ? parseInt(productId, 10) : undefined,
        status: 'DRAFT' // Default status
      },
    });

    res.status(201).json(newResearch);
  } catch (error) {
    console.error("Error creating research:", error);
    // Check for specific Prisma errors like Foreign Key constraint failed
    if (error.code === 'P2003' || error.code === 'P2025') { // Foreign key constraint failed or Record not found
      res.status(400);
      throw new Error('Invalid createdByUserId, subcategoryId, or productId provided.');
    }
    res.status(500);
    throw new Error('Server error while creating research item.');
  }
});

// @desc    Get all research items
// @route   GET /api/research
// @access  Private (Requires read permission)
export const getAllResearch = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const { 
      status, 
      createdByUserId, 
      subcategoryId, 
      productId, 
      searchTerm // Added for text search
  } = req.query;

  const where = {};
  
  // Status filtering (can accept multiple statuses comma-separated)
  if (status) {
    const statuses = status.split(',').map(s => s.trim().toUpperCase());
    // Basic validation against enum values (adjust if ResearchStatus enum changes)
    const validStatuses = Object.values(prisma.ResearchStatus || {}); // Get enum values if Prisma client exposes them
    const filteredStatuses = statuses.filter(s => validStatuses.includes(s));
    if (filteredStatuses.length > 0) {
        where.status = { in: filteredStatuses };
    }
  }
  
  if (createdByUserId) {
    const userIdNum = parseInt(createdByUserId, 10);
    if (!isNaN(userIdNum)) where.createdByUserId = userIdNum;
  }
  if (subcategoryId) {
    const subcatIdNum = parseInt(subcategoryId, 10);
    if (!isNaN(subcatIdNum)) where.subcategoryId = subcatIdNum;
  }
  if (productId) {
    const prodIdNum = parseInt(productId, 10);
    if (!isNaN(prodIdNum)) where.productId = prodIdNum;
  }

  // Text Search Term Filter
  if (searchTerm && typeof searchTerm === 'string' && searchTerm.trim().length > 0) {
    const trimmedSearchTerm = searchTerm.trim();
    where.OR = [
      { applicationName: { contains: trimmedSearchTerm, mode: 'insensitive' } },
      { industrySector: { contains: trimmedSearchTerm, mode: 'insensitive' } },
      { useCaseDescription: { contains: trimmedSearchTerm, mode: 'insensitive' } },
      { marketPotential: { contains: trimmedSearchTerm, mode: 'insensitive' } },
      { technicalRequirements: { contains: trimmedSearchTerm, mode: 'insensitive' } },
      { competitiveLandscape: { contains: trimmedSearchTerm, mode: 'insensitive' } },
      // Add other fields to search if needed (e.g., AI summary?)
    ];
  }

  try {
    const researchItems = await prisma.industrialApplicationResearch.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        updatedAt: 'desc' 
      },
      // Exclude large text fields from list view by default? Maybe select specific fields.
      // select: { ... }
    });

    const totalItems = await prisma.industrialApplicationResearch.count({ where });

    res.json({
      data: researchItems,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit),
        totalItems,
        limit
      }
    });
  } catch (error) {
    console.error("Error fetching research items:", error);
    // Handle specific errors e.g. invalid status enum
    if (error instanceof prisma.PrismaClientKnownRequestError && error.code === 'P2022') { // Type error on filtering
         res.status(400);
         throw new Error('Invalid filter parameter provided.');
    }
    res.status(500);
    throw new Error('Server error while fetching research items.');
  }
});

// @desc    Get a single research item by ID
// @route   GET /api/research/:id
// @access  Private (TODO: Add auth middleware)
export const getResearchById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const researchId = parseInt(id, 10);

  if (isNaN(researchId)) {
    res.status(400);
    throw new Error('Invalid research ID format');
  }

  try {
    const researchItem = await prisma.industrialApplicationResearch.findUnique({
      where: { id: researchId },
      include: {
        createdByUser: { // Include basic user info of the creator
          select: { id: true, email: true } 
        },
        subcategory: true, // Include related subcategory
        product: true,     // Include related product
        attachments: {     // Include attachments
          include: {
            uploadedByUser: { select: { id: true, email: true } } // Include user who uploaded
          }
        },
        collaborators: {   // Include collaborators
          include: {
            user: { select: { id: true, email: true } } // Include collaborator user info
          }
        }
      },
    });

    if (!researchItem) {
      res.status(404);
      throw new Error('Research item not found');
    }

    res.json(researchItem);
  } catch (error) {
    console.error(`Error fetching research item with ID ${researchId}:`, error);
    // If it's the 'Not Found' error we threw, re-throw it
    if (res.statusCode === 404) {
       throw error;
    }
    res.status(500);
    throw new Error('Server error while fetching research item.');
  }
});

// @desc    Update a research item by ID & create version snapshot
// @route   PUT /api/research/:id
// @access  Private (TODO: Add auth middleware & permission checks)
export const updateResearch = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const researchId = parseInt(id, 10);
  const userId = req.user?.id; // Get user ID from authenticated user

  if (isNaN(researchId)) {
    res.status(400);
    throw new Error('Invalid research ID format');
  }
  if (!userId) {
      res.status(401);
      throw new Error('User authentication required to update research.');
  }

  const { 
    applicationName,
    industrySector,
    useCaseDescription,
    marketPotential,
    technicalRequirements,
    competitiveLandscape,
    status, 
    subcategoryId, 
    productId,
    aiSummary,
    aiRecommendations,
    aiConfidenceScore
  } = req.body;

  // Prepare updateData object only with fields actually provided
  const updateData = {};
  if (applicationName !== undefined) updateData.applicationName = applicationName;
  if (industrySector !== undefined) updateData.industrySector = industrySector;
  if (useCaseDescription !== undefined) updateData.useCaseDescription = useCaseDescription;
  if (marketPotential !== undefined) updateData.marketPotential = marketPotential;
  if (technicalRequirements !== undefined) updateData.technicalRequirements = technicalRequirements;
  if (competitiveLandscape !== undefined) updateData.competitiveLandscape = competitiveLandscape;
  if (status !== undefined) {
      // TODO: Add validation: ensure status transitions are valid (e.g., cannot go back from COMPLETED?)
      updateData.status = status; 
  }
  if (aiSummary !== undefined) updateData.aiSummary = aiSummary;
  if (aiRecommendations !== undefined) updateData.aiRecommendations = aiRecommendations;
  if (aiConfidenceScore !== undefined) updateData.aiConfidenceScore = parseFloat(aiConfidenceScore);
  if (subcategoryId !== undefined) {
    updateData.subcategoryId = subcategoryId === null ? null : parseInt(subcategoryId, 10);
  }
  if (productId !== undefined) {
    updateData.productId = productId === null ? null : parseInt(productId, 10);
  }

  if (Object.keys(updateData).length === 0) {
    res.status(400);
    throw new Error('No valid fields provided for update');
  }

  try {
    // Use Prisma transaction for atomicity
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch the current state of the item *before* update
      const currentResearch = await tx.industrialApplicationResearch.findUnique({
        where: { id: researchId },
        // Select status to check for restricted transitions
        select: { status: true, createdByUserId: true } 
      });

      if (!currentResearch) {
        // Throw error inside transaction to cause rollback
        const error = new Error('Research item not found');
        error.statusCode = 404;
        throw error;
      }

      // **Status Transition Check**
      const isReviewStatus = ['PENDING_APPROVAL', 'AI_DISCOVERED'].includes(currentResearch.status);
      if (isReviewStatus && updateData.status && updateData.status !== currentResearch.status) {
         const error = new Error(`Cannot change status from ${currentResearch.status} via this endpoint. Use /approve or /reject instead.`);
         error.statusCode = 400;
         throw error;
      }
      
      // Fetch the full data needed for snapshot *after* status check
      const fullCurrentResearch = await tx.industrialApplicationResearch.findUnique({ 
        where: { id: researchId }
      });
      if (!fullCurrentResearch) { /* Should not happen, but defensive check */ 
         throw new Error('Research item vanished during transaction.'); 
      }
      
      // TODO: Add fine-grained permission check here. Can this specific user (userId)
      // update this specific research item (currentResearch)? 
      // Check ownership (fullCurrentResearch.createdByUserId === userId) or collaboration status.

      // Exclude fields that shouldn't be in the snapshot or are managed automatically
      const { id: currentId, createdAt, updatedAt, versions, ...snapshotData } = fullCurrentResearch;

      // 2. Determine the next version number
      const lastVersion = await tx.researchVersion.findFirst({
        where: { researchId: researchId },
        orderBy: { versionNumber: 'desc' },
      });
      const nextVersionNumber = (lastVersion?.versionNumber || 0) + 1;

      // 3. Perform the update
      const updatedResearch = await tx.industrialApplicationResearch.update({
        where: { id: researchId },
        data: updateData,
      });

      // 4. Create the version snapshot
      await tx.researchVersion.create({
        data: {
          researchId: researchId,
          versionNumber: nextVersionNumber,
          dataSnapshot: snapshotData, // Snapshot of data *before* the update
          createdByUserId: userId,
          // changeDescription: "Manual update" // TODO: Add change description later
        },
      });

      return updatedResearch; // Return the updated item from the transaction
    });

    res.json(result); // Return the updated research item

  } catch (error) {
    console.error(`Error updating research item with ID ${researchId}:`, error);
    if (error.statusCode === 404 || error.statusCode === 400 || res.statusCode === 401) { // Check custom status code or existing ones
      res.status(error.statusCode || res.statusCode || 400); // Use specific status code if set
      throw error; // Re-throw the specific error
    }
    if (error.code === 'P2025') { // Foreign key constraint error
      res.status(400);
      throw new Error('Invalid subcategoryId or productId provided for update.');
    }
    res.status(500);
    throw new Error('Server error while updating research item and creating version.');
  }
});

// @desc    Delete a research item by ID
// @route   DELETE /api/research/:id
// @access  Private (TODO: Add auth middleware & permission checks)
export const deleteResearch = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const researchId = parseInt(id, 10);

  if (isNaN(researchId)) {
    res.status(400);
    throw new Error('Invalid research ID format');
  }

  try {
    // First, check if the research item exists
    const existingResearch = await prisma.industrialApplicationResearch.findUnique({
      where: { id: researchId },
    });

    if (!existingResearch) {
      res.status(404);
      throw new Error('Research item not found');
    }

    // TODO: Add permission check - does the current user have rights to delete?

    // Perform the deletion
    // Note: Related attachments and collaborators should be deleted automatically
    // due to the `onDelete: Cascade` in the schema, if set up correctly.
    // Verify schema if cascading deletes are intended.
    await prisma.industrialApplicationResearch.delete({
      where: { id: researchId },
    });

    res.status(200).json({ message: 'Research item deleted successfully' });

  } catch (error) {
    console.error(`Error deleting research item with ID ${researchId}:`, error);
    if (res.statusCode === 404 || res.statusCode === 400) {
      throw error;
    }
    // Prisma error P2014: The change you are trying to make would violate the required relation ...
    // This might happen if cascade delete isn't working as expected or if there are unexpected relations.
    if (error.code === 'P2014') {
        res.status(409); // Conflict
        throw new Error('Cannot delete research item due to existing related records.');
    }
    res.status(500);
    throw new Error('Server error while deleting research item.');
  }
});

// Helper function to check if a user can manage collaborators/attachments
// Returns true if user is creator or an EDITOR/OWNER collaborator, false otherwise
const canManageResearchItem = async (userId, researchId) => {
    if (!userId || !researchId) return false;

    const researchItem = await prisma.industrialApplicationResearch.findUnique({
        where: { id: researchId },
        select: {
            createdByUserId: true,
            collaborators: {
                where: { userId: userId },
                select: { role: true }
            }
        }
    });

    if (!researchItem) return false; // Item doesn't exist

    // Check if creator
    if (researchItem.createdByUserId === userId) {
        return true;
    }

    // Check if collaborator with EDITOR or OWNER role (adjust roles as needed)
    const collaborator = researchItem.collaborators[0];
    if (collaborator && ['OWNER', 'EDITOR'].includes(collaborator.role)) { // Define roles allowed to manage
        return true;
    }

    return false;
};

// --- Collaborator Management ---

// @desc    Add a collaborator to a research item
// @route   POST /api/research/:id/collaborators
// @access  Private (Requires manage_collaborators permission + item ownership/edit role)
export const addCollaborator = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const researchId = parseInt(id, 10);
  const { userId, role } = req.body; 
  const requestingUserId = req.user?.id; // User making the request

  if (isNaN(researchId) || !userId || !role || !requestingUserId) {
    res.status(400);
    throw new Error('Invalid input: Missing researchId, userId, role, or authentication.');
  }

  // Permission Check: Can requesting user manage this item?
  const canManage = await canManageResearchItem(requestingUserId, researchId);
  if (!canManage) {
      res.status(403); // Forbidden
      throw new Error('You do not have permission to add collaborators to this research item.');
  }

  const collaboratorUserId = parseInt(userId, 10);
  if (isNaN(collaboratorUserId)) {
    res.status(400);
    throw new Error('Invalid userId format');
  }

  // TODO: Validate the 'role' against allowed values (maybe use an enum later)

  try {
    // Check if research item exists
    const researchExists = await prisma.industrialApplicationResearch.findUnique({ where: { id: researchId } });
    if (!researchExists) {
      res.status(404);
      throw new Error('Research item not found');
    }

    // Check if user exists
    const userExists = await prisma.user.findUnique({ where: { id: collaboratorUserId } });
    if (!userExists) {
      res.status(404);
      throw new Error('User to be added as collaborator not found');
    }

    // TODO: Add permission check - Can the current user add collaborators?

    // Use upsert to add or update the collaborator role if they already exist
    const collaborator = await prisma.researchCollaborator.upsert({
      where: { researchId_userId: { researchId, userId: collaboratorUserId } }, 
      update: { role }, // Update role if already a collaborator
      create: { researchId, userId: collaboratorUserId, role }, // Create if not
      include: { user: { select: { id: true, email: true } } } // Return user info
    });

    res.status(201).json(collaborator);
  } catch (error) {
    console.error(`Error adding collaborator to research ${researchId}:`, error);
    if (res.statusCode === 404 || res.statusCode === 403 || res.statusCode === 400) {
      throw error;
    }
    // Handle potential Prisma errors (e.g., unique constraint if upsert logic fails)
    if (error.code === 'P2002') { // Unique constraint failed
        res.status(409); // Conflict
        throw new Error('User is already a collaborator on this research item.');
    }
    res.status(500);
    throw new Error('Server error while adding collaborator.');
  }
});

// @desc    Remove a collaborator from a research item
// @route   DELETE /api/research/:id/collaborators/:userId
// @access  Private (Requires manage_collaborators permission + item ownership/edit role)
export const removeCollaborator = asyncHandler(async (req, res) => {
  const { id, userId } = req.params;
  const researchId = parseInt(id, 10);
  const collaboratorUserId = parseInt(userId, 10);
  const requestingUserId = req.user?.id; // User making the request

  if (isNaN(researchId) || isNaN(collaboratorUserId) || !requestingUserId) {
    res.status(400);
    throw new Error('Invalid input: Missing researchId, userId, or authentication.');
  }

  // Prevent user from removing themselves if they are the owner?
  // TODO: Add logic to check if collaboratorUserId is the owner before removing

  // Permission Check: Can requesting user manage this item?
  const canManage = await canManageResearchItem(requestingUserId, researchId);
  if (!canManage) {
      res.status(403); // Forbidden
      throw new Error('You do not have permission to remove collaborators from this research item.');
  }

  try {
    // Check if the collaborator record exists before attempting deletion
    const collaboratorExists = await prisma.researchCollaborator.findUnique({
        where: { researchId_userId: { researchId, userId: collaboratorUserId } }
    });

    if (!collaboratorExists) {
        res.status(404);
        throw new Error('Collaborator relationship not found for this user and research item.');
    }
    
    // TODO: Prevent owner from being removed entirely? Maybe require role change first?

    await prisma.researchCollaborator.delete({
      where: { researchId_userId: { researchId, userId: collaboratorUserId } },
    });

    res.status(200).json({ message: 'Collaborator removed successfully' });

  } catch (error) {
    console.error(`Error removing collaborator ${collaboratorUserId} from research ${researchId}:`, error);
     if (res.statusCode === 404 || res.statusCode === 403 || res.statusCode === 400) {
      throw error;
    }
    // Prisma error P2025: Record to delete does not exist.
    if (error.code === 'P2025') {
      res.status(404);
      throw new Error('Collaborator relationship not found.');
    }
    res.status(500);
    throw new Error('Server error while removing collaborator.');
  }
});

// --- Attachment Management ---

// @desc    Add an attachment (URL) to a research item
// @route   POST /api/research/:id/attachments
// @access  Private (Requires manage_attachments permission + item ownership/edit role)
export const addAttachment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const researchId = parseInt(id, 10);
  // uploadedByUserId should come from auth context
  const { url, attachmentType, description } = req.body; 
  const uploadedByUserId = req.user?.id; // Get from authenticated user

  if (isNaN(researchId) || !url || !attachmentType || !uploadedByUserId) {
    res.status(400);
    throw new Error('Invalid input: Missing researchId, url, attachmentType, or authentication.');
  }

  // Permission Check
  const canManage = await canManageResearchItem(uploadedByUserId, researchId);
  if (!canManage) {
      res.status(403);
      throw new Error('You do not have permission to add attachments to this research item.');
  }
  
  const userId = parseInt(uploadedByUserId, 10);
  if (isNaN(userId)) {
    res.status(400);
    throw new Error('Invalid uploadedByUserId format');
  }

  // TODO: Validate attachmentType against allowed types ('LINK', 'DOCUMENT')
  // TODO: Validate URL format

  try {
    const researchExists = await prisma.industrialApplicationResearch.findUnique({ where: { id: researchId } });
    if (!researchExists) {
      res.status(404);
      throw new Error('Research item not found');
    }
    const userExists = await prisma.user.findUnique({ where: { id: userId } });
    if (!userExists) {
      res.status(404); // Should not happen if userId comes from req.user
      throw new Error('Uploading user not found');
    }
    const newAttachment = await prisma.researchAttachment.create({
      data: {
        researchId,
        url,
        attachmentType,
        description,
        uploadedByUserId: userId,
      },
      include: { uploadedByUser: { select: { id: true, email: true } } }
    });
    res.status(201).json(newAttachment);
  } catch (error) {
     console.error(`Error adding attachment to research ${researchId}:`, error);
     if (res.statusCode === 404 || res.statusCode === 403 || res.statusCode === 400) {
      throw error;
    }
    res.status(500);
    throw new Error('Server error while adding attachment.');
  }
});

// @desc    Remove an attachment from a research item
// @route   DELETE /api/research/:id/attachments/:attachmentId
// @access  Private (Requires manage_attachments permission + item ownership/edit role)
export const removeAttachment = asyncHandler(async (req, res) => {
  const { id, attachmentId } = req.params;
  const researchId = parseInt(id, 10);
  const attachId = parseInt(attachmentId, 10);
  const requestingUserId = req.user?.id; // User making the request

  if (isNaN(researchId) || isNaN(attachId) || !requestingUserId) {
    res.status(400);
    throw new Error('Invalid input: Missing researchId, attachmentId, or authentication.');
  }

  // Permission Check
  const canManage = await canManageResearchItem(requestingUserId, researchId);
  if (!canManage) {
      res.status(403);
      throw new Error('You do not have permission to remove attachments from this research item.');
  }

  try {
    const attachment = await prisma.researchAttachment.findUnique({
      where: { id: attachId },
    });
    if (!attachment) {
        res.status(404);
        throw new Error('Attachment not found.');
    }
    if (attachment.researchId !== researchId) {
        res.status(403); 
        throw new Error('Attachment does not belong to the specified research item.');
    }
    await prisma.researchAttachment.delete({
      where: { id: attachId },
    });
    res.status(200).json({ message: 'Attachment removed successfully' });
  } catch (error) {
    console.error(`Error removing attachment ${attachId} from research ${researchId}:`, error);
    if (res.statusCode === 404 || res.statusCode === 403 || res.statusCode === 400) {
      throw error;
    }
    if (error.code === 'P2025') {
      res.status(404);
      throw new Error('Attachment not found.');
    }
    res.status(500);
    throw new Error('Server error while removing attachment.');
  }
});

// --- AI Integration --- 

import { 
    generateAiSummary, 
    generateAiRecommendations, 
    performOnlineResearch, 
    generateResearchDraftFromTopic, 
    findManufacturingLeads 
} from '../services/research/aiResearchService.js';

// @desc    Generate AI summary for a research item
// @route   POST /api/research/:id/generate-summary
// @access  Private (Requires RESEARCHER or ADMIN role - use authorizePermission)
export const generateResearchSummary = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const researchId = parseInt(id, 10);

  if (isNaN(researchId)) {
    res.status(400);
    throw new Error('Invalid research ID format');
  }

  try {
    // Fetch the research item
    const researchItem = await prisma.industrialApplicationResearch.findUnique({
      where: { id: researchId },
    });

    if (!researchItem) {
      res.status(404);
      throw new Error('Research item not found');
    }

    // TODO: Add permission check if needed (already handled by route middleware?)

    // Generate the summary
    const summary = await generateAiSummary(researchItem);

    // Update the research item with the generated summary
    const updatedResearch = await prisma.industrialApplicationResearch.update({
      where: { id: researchId },
      data: { aiSummary: summary },
    });

    res.json({ 
      message: 'AI summary generated successfully', 
      aiSummary: summary, 
      updatedItem: updatedResearch // Optionally return the updated item
    });

  } catch (error) {
    console.error(`Error generating AI summary for research ${researchId}:`, error);
    if (res.statusCode === 404 || res.statusCode === 400) {
      throw error;
    }
    // Handle specific errors from the AI service
    if (error.message.includes('API key not configured')) {
        res.status(503); // Service Unavailable
        throw new Error('AI service is not configured.')
    }
    res.status(500);
    throw new Error('Server error while generating AI summary.');
  }
});

// @desc    Generate AI recommendations for a research item
// @route   POST /api/research/:id/generate-recommendations
// @access  Private (Requires RESEARCHER or ADMIN role)
export const generateResearchRecommendations = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const researchId = parseInt(id, 10);

  if (isNaN(researchId)) {
    res.status(400);
    throw new Error('Invalid research ID format');
  }

  try {
    const researchItem = await prisma.industrialApplicationResearch.findUnique({
      where: { id: researchId },
    });

    if (!researchItem) {
      res.status(404);
      throw new Error('Research item not found');
    }

    const recommendations = await generateAiRecommendations(researchItem);

    const updatedResearch = await prisma.industrialApplicationResearch.update({
      where: { id: researchId },
      data: { aiRecommendations: recommendations },
    });

    res.json({ 
        message: 'AI recommendations generated successfully', 
        aiRecommendations: recommendations,
        updatedItem: updatedResearch
    });

  } catch (error) {
    console.error(`Error generating AI recommendations for research ${researchId}:`, error);
    if (res.statusCode === 404 || res.statusCode === 400) {
      throw error;
    }
     if (error.message.includes('API key not configured')) {
        res.status(503);
        throw new Error('AI service is not configured.')
    }
    res.status(500);
    throw new Error('Server error while generating AI recommendations.');
  }
});

// @desc    Perform online research using Perplexity
// @route   POST /api/research/online-search
// @access  Private (Requires RESEARCHER or ADMIN role)
export const getOnlineResearch = asyncHandler(async (req, res) => {
    const { query } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
        res.status(400);
        throw new Error('Research query (string) is required in the request body.');
    }

    try {
        const researchResult = await performOnlineResearch(query);
        res.json({ result: researchResult });
    } catch (error) {
        console.error(`Error performing online research for query "${query}":`, error);
        if (error.message.includes('API key not configured')) {
            res.status(503);
            throw new Error('Online research service is not configured.');
        }
        if (error.message.includes('Perplexity API Error')) {
             res.status(502); // Bad Gateway from upstream API
             throw new Error(error.message);
        }
        if (error.message.includes('query cannot be empty')){
            res.status(400);
            throw error;
        }
        res.status(500);
        throw new Error('Server error while performing online research.');
    }
});

// --- AI Draft Creation ---

// @desc    Create a research draft using AI based on a topic
// @route   POST /api/research/ai-create
// @access  Private (Requires RESEARCHER or ADMIN role - using 'use_ai' permission)
export const createResearchFromTopic = asyncHandler(async (req, res) => {
    const { topic } = req.body;
    // TODO: Get creatorUserId from authenticated user context (req.user.id)
    const creatorUserId = req.user?.id; // Assuming authenticateToken middleware runs first

    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
        res.status(400);
        throw new Error('Research topic (string) is required in the request body.');
    }
    if (!creatorUserId) {
        res.status(401); // Or 403 if authentication is assumed but user ID missing
        throw new Error('User authentication required to create research.');
    }

    try {
        // 1. Generate structured data using the AI service
        const draftData = await generateResearchDraftFromTopic(topic, creatorUserId);

        // 2. Create the research item in the database with PENDING_APPROVAL status
        const newResearchDraft = await prisma.industrialApplicationResearch.create({
            data: {
                applicationName: draftData.applicationName, // Required field
                industrySector: draftData.industrySector, // Optional from AI
                useCaseDescription: draftData.useCaseDescription,
                marketPotential: draftData.marketPotential,
                technicalRequirements: draftData.technicalRequirements,
                competitiveLandscape: draftData.competitiveLandscape,
                // Relations (subcategoryId, productId) are typically null initially for AI drafts
                // AI fields (aiSummary, etc.) are initially null
                createdByUserId: draftData.createdByUserId,
                status: 'PENDING_APPROVAL' // Set status explicitly
            },
        });

        res.status(201).json({
            message: 'AI research draft created successfully and is pending approval.',
            researchItem: newResearchDraft,
        });

    } catch (error) {
        console.error(`Error creating AI research draft for topic "${topic}":`, error);
        // Pass through specific errors from the AI service
        if (error.message.includes('API key not configured') || 
            error.message.includes('Failed to parse') || 
            error.message.includes('No JSON object') || 
            error.message.includes('Perplexity API Error') || 
            error.message.includes('did not return a valid response')) {
            res.status(500); // Or map specific errors to codes like 502, 400
            throw new Error(`AI Generation Failed: ${error.message}`);
        }
         if (error.message.includes('topic cannot be empty')){
            res.status(400);
            throw error;
        }
        res.status(500);
        throw new Error('Server error while creating AI research draft.');
    }
});

// --- Version History ---

// @desc    Get the version history for a research item
// @route   GET /api/research/:id/history
// @access  Private (Requires read permission)
export const getResearchHistory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const researchId = parseInt(id, 10);

    if (isNaN(researchId)) {
        res.status(400);
        throw new Error('Invalid research ID format');
    }

    try {
        // Check if the research item exists (optional, but good practice)
        const researchExists = await prisma.industrialApplicationResearch.findUnique({
             where: { id: researchId },
             select: { id: true } // Select only needed field
         });
        if (!researchExists) {
            res.status(404);
            throw new Error('Research item not found');
        }
        
        // TODO: Check user permission to view this specific item's history?
        
        const versions = await prisma.researchVersion.findMany({
            where: { researchId: researchId },
            orderBy: { versionNumber: 'desc' }, // Show newest versions first
            include: {
                createdByUser: { // Include user info for who made the change
                    select: { id: true, email: true }
                }
            }
        });

        res.json(versions);

    } catch (error) {
        console.error(`Error fetching history for research ${researchId}:`, error);
        if (res.statusCode === 404 || res.statusCode === 400) {
            throw error;
        }
        res.status(500);
        throw new Error('Server error while fetching research history.');
    }
});

// --- Export --- 

// @desc    Export research items as CSV
// @route   GET /api/research/export/csv
// @access  Private (Requires read permission)
export const exportResearchCsv = asyncHandler(async (req, res) => {
    // TODO: Add filtering based on query parameters similar to getAllResearch?
    // For now, export all non-pending items.
    try {
        const researchItems = await prisma.industrialApplicationResearch.findMany({
            where: {
                // Exclude non-active/non-completed items from default export
                 status: { 
                    notIn: ['PENDING_APPROVAL', 'AI_DISCOVERED', 'REJECTED']
                }
            },
            orderBy: {
                updatedAt: 'desc' 
            },
            include: { // Include related data to flatten into CSV
                createdByUser: { select: { email: true } },
                subcategory: { select: { name: true } },
                product: { select: { name: true } }
            }
        });

        if (researchItems.length === 0) {
             res.status(404).send('No research items found to export.');
             return;
        }

        // Define CSV headers and structure
        const csvStringifier = createObjectCsvStringifier({
            header: [
                { id: 'id', title: 'ID' },
                { id: 'applicationName', title: 'Application Name' },
                { id: 'status', title: 'Status' },
                { id: 'industrySector', title: 'Industry Sector' },
                { id: 'useCaseDescription', title: 'Use Case Description' },
                { id: 'marketPotential', title: 'Market Potential' },
                { id: 'technicalRequirements', title: 'Technical Requirements' },
                { id: 'competitiveLandscape', title: 'Competitive Landscape' },
                { id: 'subcategoryName', title: 'Subcategory' },
                { id: 'productName', title: 'Product' },
                { id: 'aiSummary', title: 'AI Summary' },
                { id: 'aiRecommendations', title: 'AI Recommendations' },
                { id: 'aiConfidenceScore', title: 'AI Confidence Score' },
                { id: 'creatorEmail', title: 'Created By' },
                { id: 'createdAt', title: 'Created At' },
                { id: 'updatedAt', title: 'Last Updated' },
                // TODO: Add collaborators? Attachments? Might make CSV complex.
            ]
        });

        // Format data for CSV
        const records = researchItems.map(item => ({
            id: item.id,
            applicationName: item.applicationName,
            status: item.status,
            industrySector: item.industrySector,
            useCaseDescription: item.useCaseDescription,
            marketPotential: item.marketPotential,
            technicalRequirements: item.technicalRequirements,
            competitiveLandscape: item.competitiveLandscape,
            subcategoryName: item.subcategory?.name || '',
            productName: item.product?.name || '',
            aiSummary: item.aiSummary,
            aiRecommendations: item.aiRecommendations,
            aiConfidenceScore: item.aiConfidenceScore,
            creatorEmail: item.createdByUser?.email || '',
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString(),
        }));

        const csvData = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);

        // Set headers for CSV download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="research_export.csv"');
        res.status(200).send(csvData);

    } catch (error) {
        console.error("Error exporting research to CSV:", error);
        res.status(500);
        throw new Error('Server error while exporting research data.');
    }
});

// --- Stats --- 

// @desc    Get counts of research items grouped by status
// @route   GET /api/research/stats/status-counts
// @access  Private (Requires read permission)
export const getResearchStatusCounts = asyncHandler(async (req, res) => {
    try {
        const statusCounts = await prisma.industrialApplicationResearch.groupBy({
            by: ['status'],
            _count: {
                status: true,
            },
        });

        // Format the result into a more friendly object { PENDING_APPROVAL: 5, DRAFT: 10, ... }
        const formattedCounts = statusCounts.reduce((acc, current) => {
            acc[current.status] = current._count.status;
            return acc;
        }, {});

        // Ensure all statuses are present, even if count is 0
        for (const statusValue of Object.values(prisma.ResearchStatus || {})) {
             if (!formattedCounts[statusValue]) {
                formattedCounts[statusValue] = 0;
             }
        }

        res.json(formattedCounts);

    } catch (error) {
        console.error("Error fetching research status counts:", error);
        res.status(500);
        throw new Error('Server error while fetching research status counts.');
    }
});

// --- Review Actions --- 

// @desc    Approve an AI-discovered or pending research item
// @route   PUT /api/research/:id/approve
// @access  Private (Requires research:update permission)
export const approveResearch = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const researchId = parseInt(id, 10);
  const userId = req.user?.id; // Get user ID from authenticated request

  if (isNaN(researchId)) {
    res.status(400);
    throw new Error('Invalid Research ID format.');
  }
  if (!userId) {
    res.status(401);
    throw new Error('User authentication required to approve research.');
  }

  try {
    const researchItem = await prisma.industrialApplicationResearch.findUnique({
      where: { id: researchId },
    });

    if (!researchItem) {
      res.status(404);
      throw new Error('Research item not found.');
    }

    // Check if the item is in a status eligible for approval
    if (!['AI_DISCOVERED', 'PENDING_APPROVAL'].includes(researchItem.status)) {
      res.status(400);
      throw new Error(`Research item is not in AI_DISCOVERED or PENDING_APPROVAL status (current: ${researchItem.status}). Cannot approve.`);
    }

    // Update the status to REVIEWED (or DRAFT)
    // Using REVIEWED to differentiate from purely manual drafts.
    const updatedResearch = await prisma.industrialApplicationResearch.update({
      where: { id: researchId },
      data: { 
        status: 'REVIEWED' 
        // Note: We don't trigger versioning on simple status changes like approve/reject
        // Versioning happens via the main updateResearch endpoint.
      },
    });

    res.json({ message: 'Research item approved successfully.', researchItem: updatedResearch });

  } catch (error) {
    console.error(`Error approving research item ${researchId}:`, error);
    if (res.statusCode === 404 || res.statusCode === 401 || res.statusCode === 400) {
        throw error;
    }
    res.status(500);
    throw new Error('Server error while approving research item.');
  }
});

// @desc    Reject an AI-discovered or pending research item
// @route   PUT /api/research/:id/reject
// @access  Private (Requires research:update permission)
export const rejectResearch = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const researchId = parseInt(id, 10);
  const userId = req.user?.id; // Get user ID from authenticated request

  if (isNaN(researchId)) {
    res.status(400);
    throw new Error('Invalid Research ID format.');
  }
  if (!userId) {
    res.status(401);
    throw new Error('User authentication required to reject research.');
  }

  try {
    const researchItem = await prisma.industrialApplicationResearch.findUnique({
      where: { id: researchId },
    });

    if (!researchItem) {
      res.status(404);
      throw new Error('Research item not found.');
    }

    // Check if the item is in a status eligible for rejection
    if (!['AI_DISCOVERED', 'PENDING_APPROVAL'].includes(researchItem.status)) {
      res.status(400);
      throw new Error(`Research item is not in AI_DISCOVERED or PENDING_APPROVAL status (current: ${researchItem.status}). Cannot reject.`);
    }

    // Update the status to REJECTED
    const updatedResearch = await prisma.industrialApplicationResearch.update({
      where: { id: researchId },
      data: { status: 'REJECTED' },
    });

    res.json({ message: 'Research item rejected successfully.', researchItem: updatedResearch });

  } catch (error) {
    console.error(`Error rejecting research item ${researchId}:`, error);
     if (res.statusCode === 404 || res.statusCode === 401 || res.statusCode === 400) {
        throw error;
    }
    res.status(500);
    throw new Error('Server error while rejecting research item.');
  }
});

// --- Lead Discovery from Research ---

// @desc    Discover potential manufacturing leads for a specific research item
// @route   POST /api/research/:researchId/discover-leads
// @access  Private (Requires specific permission/role, e.g., 'lead:create')
export const discoverLeadsForResearch = asyncHandler(async (req, res) => {
    const { researchId: researchIdString } = req.params;
    const researchId = parseInt(researchIdString, 10);
    // Assuming authentication is handled by middleware and req.user is available
    const requestingUserId = req.user?.id; 

    if (isNaN(researchId)) {
        res.status(400);
        throw new Error('Invalid Research ID format.');
    }
    /* // Temporarily comment out the internal auth check
    if (!requestingUserId) {
        // This check should ideally be enforced by middleware
        res.status(401);
        throw new Error('User authentication required to discover leads.');
    }
    */

    try {
        // --- TEMPORARY FIX for disabled auth: Get Default User --- 
        let effectiveUserId = requestingUserId;
        if (!effectiveUserId) {
            const defaultUser = await prisma.user.findFirst({ orderBy: { id: 'asc' } });
            if (!defaultUser) {
                res.status(500);
                throw new Error('Could not find a default user for lead creation when authentication is disabled.');
            }
            effectiveUserId = defaultUser.id; 
            console.warn(`Auth disabled for discover-leads. Using default user ID ${effectiveUserId} for createdByUserId.`);
        }
        // --- END TEMPORARY FIX ---

        // 1. Fetch the research item and its linked product
        const researchItem = await prisma.industrialApplicationResearch.findUnique({
            where: { id: researchId },
            include: {
                // Include the product from which this research was discovered OR manually linked
                discoveredFromProduct: true, // The product that *led* to this research
                product: true // The product *manually linked* to this research (if any)
            }
        });

        if (!researchItem) {
            res.status(404);
            throw new Error('Research item not found.');
        }

        // Determine the relevant product for the AI prompt
        const productData = researchItem.discoveredFromProduct || researchItem.product;
        if (!productData) {
            res.status(400); 
            throw new Error('Cannot discover leads: Research item is not linked to a source product.');
        }

        // 2. Call the AI service to find potential leads
        console.log(`Initiating lead discovery for Research ID: ${researchId}, Product ID: ${productData.id}`);
        const potentialLeads = await findManufacturingLeads(researchItem, productData);
        console.log(`AI discovered ${potentialLeads.length} potential leads.`);

        if (!potentialLeads || potentialLeads.length === 0) {
            return res.status(200).json({ message: 'AI lead discovery completed, but no potential manufacturing companies were identified.', discoveredCount: 0, createdCount: 0 });
        }

        // 3. Prepare for duplicate checking and creation
        const leadDataToCreate = [];
        const existingDomains = new Set();

        // Get existing lead domains for duplicate checking (can be optimized for large scale)
        const existingLeads = await prisma.lead.findMany({
            where: { website: { not: null } },
            select: { website: true }
        });
        existingLeads.forEach(lead => {
            try {
                const domain = new URL(lead.website).hostname.replace(/^www\./, '');
                existingDomains.add(domain);
            } catch (e) { /* Ignore invalid URLs in existing leads */ }
        });

        for (const lead of potentialLeads) {
            try {
                if (!lead.website || !lead.name) continue; // Skip if essential data missing
                
                // Normalize and check domain for duplicates
                const url = new URL(lead.website);
                const domain = url.hostname.replace(/^www\./, '');
                
                if (!existingDomains.has(domain)) {
                    leadDataToCreate.push({
                        name: lead.name, 
                        website: lead.website,
                        status: 'NEW', 
                        source: 'AI Discovery',
                        sourceResearchId: researchId, 
                        // ADD productId from the research item's linked product
                        productId: productData.id, 
                        // Use effectiveUserId (real or default)
                        createdByUserId: effectiveUserId, 
                        industry: researchItem.industrySector || null, 
                    });
                    existingDomains.add(domain); 
                }
            } catch (e) {
                console.warn(`Skipping potential lead due to invalid URL: ${lead.website}`, e.message);
            }
        }
        
        if (leadDataToCreate.length === 0) {
             return res.status(200).json({ message: 'AI lead discovery completed. All identified companies already exist as leads or had invalid data.', discoveredCount: potentialLeads.length, createdCount: 0 });
        }

        // 4. Create new Lead records
        console.log(`Attempting to create ${leadDataToCreate.length} new unique leads...`);
        const creationResult = await prisma.lead.createMany({
            data: leadDataToCreate,
            skipDuplicates: true, // Just in case (though manual check is primary)
        });

        console.log(`Successfully created ${creationResult.count} new leads.`);
        res.status(201).json({ 
            message: `Successfully discovered leads. ${creationResult.count} new unique manufacturing leads created.`, 
            discoveredCount: potentialLeads.length,
            createdCount: creationResult.count
        });

    } catch (error) {
        console.error(`Error discovering leads for research ID ${researchId}:`, error);
        // Handle specific errors (e.g., AI service errors, DB errors)
        if (res.statusCode < 400) { // If no specific status set yet
             res.status(500); 
        }
        throw error; // Let the global error handler format the response
    }
}); 