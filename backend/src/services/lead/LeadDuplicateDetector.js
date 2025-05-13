/**
 * Service for detecting duplicate leads using fuzzy matching algorithms
 */
export class LeadDuplicateDetector {
  /**
   * Create a new duplicate detector with the specified configuration
   * @param {Object} config - Configuration options
   * @param {number} [config.nameThreshold=0.8] - Similarity threshold for organization names (0-1)
   * @param {number} [config.websiteThreshold=0.9] - Similarity threshold for websites (0-1)
   * @param {number} [config.emailThreshold=0.9] - Similarity threshold for email addresses (0-1)
   * @param {boolean} [config.ignoreCase=true] - Whether to ignore case when comparing strings
   * @param {boolean} [config.ignoreSpaces=true] - Whether to ignore spaces when comparing strings
   * @param {boolean} [config.ignorePunctuation=true] - Whether to ignore punctuation when comparing strings
   */
  constructor(config = {}) {
    this.nameThreshold = config.nameThreshold || 0.8
    this.websiteThreshold = config.websiteThreshold || 0.9
    this.emailThreshold = config.emailThreshold || 0.9
    this.ignoreCase = config.ignoreCase !== false
    this.ignoreSpaces = config.ignoreSpaces !== false
    this.ignorePunctuation = config.ignorePunctuation !== false
  }

  /**
   * Calculate similarity score between two leads
   * @param {Object} lead1 - First lead
   * @param {Object} lead2 - Second lead
   * @returns {Object} - Similarity scores and overall confidence
   */
  calculateSimilarity(lead1, lead2) {
    // Calculate individual field similarities
    const nameSimilarity = this.calculateStringSimilarity(
      lead1.name,
      lead2.name,
      { method: 'levenshtein' }
    )
    
    // Website similarity (domain comparison)
    const websiteSimilarity = lead1.website && lead2.website 
      ? this.calculateDomainSimilarity(lead1.website, lead2.website)
      : 0
    
    // Email similarity (domain comparison)
    const emailSimilarity = lead1.email && lead2.email
      ? this.calculateStringSimilarity(lead1.email, lead2.email, { method: 'exact' })
      : 0
    
    // Calculate weighted overall score
    // Domains are strong indicators, so they get higher weight
    let overallScore = 0
    let weightSum = 0

    // Name is always considered
    overallScore += nameSimilarity * 0.6
    weightSum += 0.6

    // Only consider website if both have it
    if (lead1.website && lead2.website) {
      overallScore += websiteSimilarity * 0.3
      weightSum += 0.3
    }

    // Only consider email if both have it
    if (lead1.email && lead2.email) {
      overallScore += emailSimilarity * 0.1
      weightSum += 0.1
    }

    // Normalize score
    const normalizedScore = weightSum > 0 ? overallScore / weightSum : 0
    
    // Return detailed similarity information
    return {
      overallScore: normalizedScore,
      fields: {
        name: nameSimilarity,
        website: websiteSimilarity,
        email: emailSimilarity
      },
      isDuplicate: normalizedScore >= this.nameThreshold
    }
  }

  /**
   * Calculate similarity between two strings using various algorithms
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @param {Object} options - Options for string comparison
   * @param {string} [options.method='levenshtein'] - Comparison method: 'levenshtein', 'jaccard', or 'exact'
   * @returns {number} - Similarity score between 0 and 1
   */
  calculateStringSimilarity(str1, str2, options = {}) {
    // Handle null or undefined inputs
    if (!str1 || !str2) return 0
    
    // Normalize strings based on configuration
    const s1 = this.normalizeString(str1)
    const s2 = this.normalizeString(str2)
    
    // If strings are identical after normalization, they're a perfect match
    if (s1 === s2) return 1
    
    // Choose comparison method
    const method = options.method || 'levenshtein'
    
    switch (method) {
      case 'exact':
        // Exact matching (binary: 1 if same, 0 if different)
        return s1 === s2 ? 1 : 0
        
      case 'jaccard':
        // Jaccard similarity (word overlap)
        return this.calculateJaccardSimilarity(s1, s2)
        
      case 'levenshtein':
      default:
        // Levenshtein distance (edit distance)
        return this.calculateLevenshteinSimilarity(s1, s2)
    }
  }

  /**
   * Normalize a string for comparison
   * @param {string} str - Input string
   * @returns {string} - Normalized string
   */
  normalizeString(str) {
    if (!str) return ''
    
    let normalized = str
    
    // Apply normalization based on configuration
    if (this.ignoreCase) {
      normalized = normalized.toLowerCase()
    }
    
    if (this.ignorePunctuation) {
      normalized = normalized.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
    }
    
    if (this.ignoreSpaces) {
      normalized = normalized.replace(/\s+/g, '')
    }
    
    return normalized
  }

  /**
   * Calculate Levenshtein distance and convert to similarity score
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} - Similarity score between 0 and 1
   */
  calculateLevenshteinSimilarity(str1, str2) {
    const len1 = str1.length
    const len2 = str2.length
    
    // If either string is empty, similarity is 0
    if (len1 === 0 || len2 === 0) return 0
    
    // Create matrix
    const matrix = Array(len1 + 1).fill().map(() => Array(len2 + 1).fill(0))
    
    // Initialize first row and column
    for (let i = 0; i <= len1; i++) matrix[i][0] = i
    for (let j = 0; j <= len2; j++) matrix[0][j] = j
    
    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,        // deletion
          matrix[i][j - 1] + 1,        // insertion
          matrix[i - 1][j - 1] + cost  // substitution
        )
      }
    }
    
    // Calculate normalized similarity (1 - normalized distance)
    const distance = matrix[len1][len2]
    const maxLen = Math.max(len1, len2)
    
    // If both strings are empty, they're identical
    if (maxLen === 0) return 1
    
    return 1 - (distance / maxLen)
  }

  /**
   * Calculate Jaccard similarity (word overlap) between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} - Similarity score between 0 and 1
   */
  calculateJaccardSimilarity(str1, str2) {
    // Split strings into words
    const words1 = str1.split(/\s+/).filter(Boolean)
    const words2 = str2.split(/\s+/).filter(Boolean)
    
    // Convert to sets
    const set1 = new Set(words1)
    const set2 = new Set(words2)
    
    // If both sets are empty, they're identical
    if (set1.size === 0 && set2.size === 0) return 1
    if (set1.size === 0 || set2.size === 0) return 0
    
    // Calculate intersection
    const intersection = new Set(
      [...set1].filter(word => set2.has(word))
    )
    
    // Calculate union
    const union = new Set([...set1, ...set2])
    
    // Return Jaccard coefficient
    return intersection.size / union.size
  }

  /**
   * Compare two domains for similarity
   * @param {string} url1 - First URL
   * @param {string} url2 - Second URL
   * @returns {number} - Similarity score between 0 and 1
   */
  calculateDomainSimilarity(url1, url2) {
    // Extract domains from URLs
    const domain1 = this.extractDomain(url1)
    const domain2 = this.extractDomain(url2)
    
    // If both failed to parse, return 0
    if (!domain1 || !domain2) return 0
    
    // Exact domain match (subdomains, different TLDs may differ)
    if (domain1 === domain2) return 1
    
    // Calculate similarity of domain parts
    return this.calculateLevenshteinSimilarity(domain1, domain2)
  }

  /**
   * Extract domain from URL
   * @param {string} url - URL to parse
   * @returns {string|null} - Extracted domain or null
   */
  extractDomain(url) {
    if (!url) return null
    
    try {
      // Remove protocol and path
      let domain = url.toLowerCase()
      domain = domain.replace(/^https?:\/\//, '')  // Remove protocol
      domain = domain.replace(/\/.*$/, '')         // Remove path
      domain = domain.replace(/:[0-9]+$/, '')      // Remove port
      
      // Extract the domain and remove 'www.'
      const parts = domain.split('.')
      
      // Remove 'www' if it's the first part
      if (parts[0] === 'www' && parts.length > 2) {
        parts.shift()
      }
      
      // For most URLs, we want the main domain (without subdomain)
      // But for URLs like 'example.co.uk', we need to handle country codes
      // This is a simplified approach that works for most cases
      
      if (parts.length > 2) {
        // Check for country codes like .co.uk, .com.au
        const lastPart = parts[parts.length - 1]
        const secondLastPart = parts[parts.length - 2]
        
        if (lastPart.length === 2 && secondLastPart.length <= 3) {
          // Likely a country code, take last 3 parts
          return parts.slice(parts.length - 3).join('.')
        } else {
          // Regular domain, take last 2 parts
          return parts.slice(parts.length - 2).join('.')
        }
      } else {
        // Already a simple domain
        return parts.join('.')
      }
    } catch (error) {
      console.error('Error extracting domain:', error)
      return null
    }
  }

  /**
   * Find potential duplicates of a lead in an array of leads
   * @param {Object} targetLead - Lead to check for duplicates
   * @param {Array<Object>} existingLeads - Array of existing leads to check against
   * @param {Object} options - Options for duplicate detection
   * @param {number} [options.threshold] - Override the default similarity threshold
   * @param {boolean} [options.includeScores=false] - Whether to include similarity scores in results
   * @returns {Array<Object>} - Array of potential duplicates with similarity scores
   */
  findPotentialDuplicates(targetLead, existingLeads, options = {}) {
    const threshold = options.threshold || this.nameThreshold
    const includeScores = options.includeScores || false
    
    const potentialDuplicates = []
    
    for (const existingLead of existingLeads) {
      // Skip comparing with self
      if (targetLead.id && existingLead.id && targetLead.id === existingLead.id) {
        continue
      }
      
      // Calculate similarity
      const similarity = this.calculateSimilarity(targetLead, existingLead)
      
      // If similarity is above threshold, consider it a potential duplicate
      if (similarity.overallScore >= threshold) {
        if (includeScores) {
          potentialDuplicates.push({
            lead: existingLead,
            similarity
          })
        } else {
          potentialDuplicates.push(existingLead)
        }
      }
    }
    
    // Sort by similarity score (highest first) if scores are included
    if (includeScores) {
      potentialDuplicates.sort((a, b) => b.similarity.overallScore - a.similarity.overallScore)
    }
    
    return potentialDuplicates
  }

  /**
   * Merge two leads, preserving the most detailed and recent information
   * @param {Object} primaryLead - Primary lead (will be preserved)
   * @param {Object} secondaryLead - Secondary lead (will be merged into primary)
   * @returns {Object} - Merged lead
   */
  mergeLeads(primaryLead, secondaryLead) {
    // Create a copy of the primary lead
    const mergedLead = { ...primaryLead }
    
    // Helper function to choose the best value
    const chooseBest = (field, preferNewer = true) => {
      // If the primary lead doesn't have this field but secondary does, use secondary
      if (mergedLead[field] === null || mergedLead[field] === undefined) {
        mergedLead[field] = secondaryLead[field]
        return
      }
      
      // If the secondary lead doesn't have this field, keep primary
      if (secondaryLead[field] === null || secondaryLead[field] === undefined) {
        return
      }
      
      // For dates, prefer the newer one if preferNewer is true
      if (preferNewer && field.toLowerCase().includes('date') && 
          mergedLead[field] && secondaryLead[field]) {
        const date1 = new Date(mergedLead[field])
        const date2 = new Date(secondaryLead[field])
        
        if (!isNaN(date1.getTime()) && !isNaN(date2.getTime())) {
          mergedLead[field] = date1 > date2 ? mergedLead[field] : secondaryLead[field]
          return
        }
      }
      
      // For strings, prefer non-empty and longer strings
      if (typeof mergedLead[field] === 'string' && typeof secondaryLead[field] === 'string') {
        if (mergedLead[field].trim() === '') {
          mergedLead[field] = secondaryLead[field]
        } else if (secondaryLead[field].trim() !== '' && 
                  secondaryLead[field].length > mergedLead[field].length) {
          mergedLead[field] = secondaryLead[field]
        }
        return
      }
      
      // For numbers, prefer non-zero values
      if (typeof mergedLead[field] === 'number' && typeof secondaryLead[field] === 'number') {
        if (mergedLead[field] === 0 && secondaryLead[field] !== 0) {
          mergedLead[field] = secondaryLead[field]
        }
        return
      }
    }
    
    // Process standard fields
    const fieldsToCopy = [
      'name', 'email', 'phone', 'website', 'industry', 'location', 'description',
      'employeeCount', 'annualRevenue', 'foundedYear', 'linkedInUrl'
    ]
    
    for (const field of fieldsToCopy) {
      chooseBest(field)
    }
    
    // Merge tags (if they exist)
    if (Array.isArray(mergedLead.tags) || Array.isArray(secondaryLead.tags)) {
      const tags1 = Array.isArray(mergedLead.tags) ? mergedLead.tags : []
      const tags2 = Array.isArray(secondaryLead.tags) ? secondaryLead.tags : []
      mergedLead.tags = [...new Set([...tags1, ...tags2])]
    }
    
    // Merge notes (if they exist)
    if (mergedLead.notes || secondaryLead.notes) {
      if (!mergedLead.notes) {
        mergedLead.notes = secondaryLead.notes
      } else if (secondaryLead.notes) {
        mergedLead.notes = `${mergedLead.notes}\n\nMerged notes: ${secondaryLead.notes}`
      }
    }
    
    // Update timestamps
    mergedLead.updatedAt = new Date().toISOString()
    
    // Add merge history
    mergedLead.mergeHistory = mergedLead.mergeHistory || []
    mergedLead.mergeHistory.push({
      mergedLeadId: secondaryLead.id,
      mergedAt: new Date().toISOString()
    })
    
    return mergedLead
  }
} 