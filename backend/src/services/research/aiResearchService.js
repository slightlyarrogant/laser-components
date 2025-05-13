import OpenAI from 'openai';
// TODO: Potentially use a more specific client if switching from OpenAI compatibility
// import Anthropic from '@anthropic-ai/sdk'; 

// Load API keys and model names from environment variables
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const PERPLEXITY_MODEL = process.env.PERPLEXITY_MODEL || 'sonar-medium-online'; // Or use another like llama-3-sonar-large-32k-online

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.MODEL || 'claude-3-haiku-20240307'; // Default to a faster model for summaries

// Configure Perplexity client using OpenAI compatibility
const perplexity = PERPLEXITY_API_KEY ? new OpenAI({
  apiKey: PERPLEXITY_API_KEY,
  baseURL: 'https://api.perplexity.ai',
}) : null;

// Configure Anthropic client (replace if not using OpenAI compatible client)
const anthropic = ANTHROPIC_API_KEY ? new OpenAI({
    apiKey: ANTHROPIC_API_KEY,
    baseURL: 'https://api.anthropic.com/v1', // Adjust if necessary
    // Add necessary headers for Anthropic if using OpenAI client
    defaultHeaders: {
      'anthropic-version': '2023-06-01', // Replace with the target Anthropic version
      'content-type': 'application/json',
    }
  }) : null;

/**
 * Generates an AI summary for a given research item's data.
 * @param {object} researchData - The data object for the research item.
 * @returns {Promise<string>} - The generated summary text.
 */
export const generateAiSummary = async (researchData) => {
  if (!anthropic) {
    throw new Error('Anthropic API key not configured. Cannot generate summary.');
  }

  const prompt = `
    Analyze the following industrial application research data and provide a concise summary (2-3 sentences) highlighting the key aspects like the application, industry, potential, and requirements. Focus on the most important takeaways.

    Research Data:
    Application Name: ${researchData.applicationName || 'N/A'}
    Industry Sector: ${researchData.industrySector || 'N/A'}
    Use Case: ${researchData.useCaseDescription || 'N/A'}
    Market Potential: ${researchData.marketPotential || 'N/A'}
    Technical Requirements: ${researchData.technicalRequirements || 'N/A'}
    Competitive Landscape: ${researchData.competitiveLandscape || 'N/A'}

    Concise Summary:
  `;

  try {
    // Using OpenAI client structure for Anthropic call
    const completion = await anthropic.chat.completions.create({
      model: ANTHROPIC_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150, // Adjust token limit as needed
      temperature: 0.5, // Lower temperature for more focused summary
    });

    // Accessing the response might differ based on exact client/API version
    // This assumes OpenAI compatible response structure
    const summary = completion.choices[0]?.message?.content?.trim(); 
    
    if (!summary) {
      throw new Error('AI did not return a valid summary.');
    }
    return summary;

  } catch (error) {
    console.error('Error generating AI summary with Anthropic:', error);
    throw new Error('Failed to generate AI summary.');
  }
};

/**
 * Generates AI recommendations based on research data.
 * @param {object} researchData - The data object for the research item.
 * @returns {Promise<string>} - The generated recommendations text.
 */
export const generateAiRecommendations = async (researchData) => {
    if (!anthropic) {
    throw new Error('Anthropic API key not configured. Cannot generate recommendations.');
  }

  const prompt = `
    Based on the following industrial application research, provide 2-3 actionable recommendations or next steps. Consider the market potential, technical needs, and competition.

    Research Data:
    Application Name: ${researchData.applicationName || 'N/A'}
    Industry Sector: ${researchData.industrySector || 'N/A'}
    Use Case: ${researchData.useCaseDescription || 'N/A'}
    Market Potential: ${researchData.marketPotential || 'N/A'}
    Technical Requirements: ${researchData.technicalRequirements || 'N/A'}
    Competitive Landscape: ${researchData.competitiveLandscape || 'N/A'}

    Actionable Recommendations (bullet points):
    - 
  `;

  try {
    const completion = await anthropic.chat.completions.create({
      model: ANTHROPIC_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
      temperature: 0.7, // Slightly higher temperature for more creative recommendations
      stop: ['\n\n'], // Stop generation after recommendations
    });

    const recommendations = completion.choices[0]?.message?.content?.trim();
    if (!recommendations) {
      throw new Error('AI did not return valid recommendations.');
    }
    // Prepend the first bullet point if missing
    return recommendations.startsWith('-') ? recommendations : `- ${recommendations}`;

  } catch (error) {
    console.error('Error generating AI recommendations with Anthropic:', error);
    throw new Error('Failed to generate AI recommendations.');
  }
};

/**
 * Uses Perplexity AI to perform online research based on a query.
 * @param {string} query - The research query.
 * @returns {Promise<string>} - The research result text.
 */
export const performOnlineResearch = async (query) => {
  if (!perplexity) {
    throw new Error('Perplexity API key not configured. Cannot perform online research.');
  }
  
  if (!query || query.trim().length === 0) {
      throw new Error('Research query cannot be empty.');
  }

  try {
    const completion = await perplexity.chat.completions.create({
      model: PERPLEXITY_MODEL, 
      messages: [
        {
          role: 'system',
          content: 'You are an AI research assistant. Provide concise and relevant information based on the user\'s query.',
        },
        {
          role: 'user',
          content: query,
        },
      ],
      max_tokens: 500, // Adjust as needed
      temperature: 0.6, 
    });

    const researchResult = completion.choices[0]?.message?.content?.trim();
    if (!researchResult) {
        throw new Error('Perplexity AI did not return a valid research result.');
    }
    return researchResult;

  } catch (error) {
    console.error('Error performing online research with Perplexity:', error);
    // Attempt to parse Perplexity-specific errors if possible
    let message = 'Failed to perform online research with Perplexity.';
    if (error.response && error.response.data && error.response.data.detail) {
        message = `Perplexity API Error: ${error.response.data.detail}`;
    }
    throw new Error(message);
  }
};

/**
 * Uses Perplexity AI to research a topic and attempt to extract structured data 
 * matching the IndustrialApplicationResearch model fields.
 * @param {string} topic - The high-level research topic provided by the user.
 * @param {number} creatorUserId - The ID of the user initiating the research.
 * @returns {Promise<object>} - An object containing the parsed data suitable for creating a research draft.
 */
export const generateResearchDraftFromTopic = async (topic, creatorUserId) => {
  if (!perplexity) {
    throw new Error('Perplexity API key not configured. Cannot generate draft.');
  }
  if (!topic || topic.trim().length === 0) {
    throw new Error('Research topic cannot be empty.');
  }
  if (!creatorUserId) {
      throw new Error('Creator User ID is required.')
  }

  // Detailed prompt asking for structured output (attempting JSON)
  const prompt = `
    Perform deep research on the following topic: "${topic}"

    Based on your research, identify a specific potential industrial application. Extract the following information and provide it ONLY as a JSON object with these exact keys:
    - "applicationName": (string) A concise name for the specific application identified.
    - "industrySector": (string) The primary industry sector for this application (e.g., "Automotive", "Medical Devices", "Aerospace", "Electronics Manufacturing").
    - "useCaseDescription": (string) A detailed description of how the technology/product is used in this application.
    - "marketPotential": (string) A brief analysis of the market potential, growth trends, or key opportunities.
    - "technicalRequirements": (string) Key technical specifications or requirements for the technology in this application.
    - "competitiveLandscape": (string) A short summary of the competitive environment or major players.

    Example JSON output format:
    {
      "applicationName": "Example Application Name",
      "industrySector": "Example Industry",
      "useCaseDescription": "Detailed description here.",
      "marketPotential": "Market analysis here.",
      "technicalRequirements": "Technical details here.",
      "competitiveLandscape": "Competition summary here."
    }

    Return ONLY the JSON object. Do not include any other text before or after the JSON.
  `;

  try {
    const completion = await perplexity.chat.completions.create({
      model: PERPLEXITY_MODEL, 
      messages: [
        {
          role: 'system',
          content: 'You are an AI research assistant tasked with extracting specific structured information about industrial applications based on a topic. Respond ONLY with the requested JSON object.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 1000, // Increase tokens to allow for detailed JSON
      temperature: 0.5, // Lower temperature for more factual extraction
      // response_format: { type: "json_object" }, // Use if model/API supports enforced JSON output
    });

    const rawResponse = completion.choices[0]?.message?.content?.trim();
    if (!rawResponse) {
        throw new Error('Perplexity AI did not return a valid response.');
    }

    // Attempt to parse the JSON response
    let parsedData;
    try {
        // Find JSON block in case of extra text (basic attempt)
        const jsonMatch = rawResponse.match(/\{.*\}/s);
        if (!jsonMatch) {
            throw new Error('No JSON object found in the AI response.');
        }
        parsedData = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
        console.error('Failed to parse JSON response from Perplexity:', rawResponse);
        throw new Error(`Failed to parse AI response as JSON. Error: ${parseError.message}`);
    }

    // Validate expected keys (basic check)
    const requiredKeys = ['applicationName', 'industrySector', 'useCaseDescription', 'marketPotential', 'technicalRequirements', 'competitiveLandscape'];
    for (const key of requiredKeys) {
      if (!(key in parsedData) || typeof parsedData[key] !== 'string') {
        console.warn(`AI response missing or invalid type for key: ${key}`)
        // Decide how to handle missing keys - throw error or allow partial data?
        // For now, let's allow partial data but ensure required fields for DB exist later
      }
    }
    
    // Add the creatorUserId and status to the parsed data
    parsedData.createdByUserId = creatorUserId;
    parsedData.status = 'PENDING_APPROVAL'; // Or AI_DISCOVERED if preferred
    
    // TODO: Validate parsedData structure against expected fields?

    return parsedData;

  } catch (error) {
    console.error(`Error generating research draft from topic "${topic}":`, error);
    let message = 'Failed to generate research draft via AI.';
    if (error.response && error.response.data && error.response.data.detail) {
        message = `Perplexity API Error: ${error.response.data.detail}`;
    }
    // Include specific parsing errors
    if (error.message.includes('Failed to parse AI response') || error.message.includes('No JSON object found')) {
        message = error.message;
    }
    throw new Error(message);
  }
};

/**
 * Uses Perplexity AI to research potential industrial applications for a specific product.
 * @param {number} productId - The ID of the product to research.
 * @returns {Promise<Array<object>>} - An array of objects, each representing a potential application.
 */
export const discoverApplicationsForProduct = async (productId) => {
  if (!perplexity) {
    throw new Error('Perplexity API key not configured. Cannot discover applications.');
  }
  if (!productId) {
    throw new Error('Product ID is required.');
  }

  // 1. Fetch Product Details
  let product;
  try {
    // Assuming prisma instance is available or imported in this scope
    // If not, you'll need: import { PrismaClient } from '@prisma/client'; const prisma = new PrismaClient();
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        description: true,
        subcategory: { select: { name: true, category: { select: { name: true } } } }
      }
    });
    await prisma.$disconnect(); // Disconnect after query

    if (!product) {
      throw new Error(`Product with ID ${productId} not found.`);
    }
  } catch (dbError) {
    console.error(`Database error fetching product ${productId}:`, dbError);
    throw new Error(`Failed to fetch product details for ID ${productId}.`);
  }

  // 2. Construct Detailed Prompt for Multiple Applications
  const prompt = `
    Perform deep research on the following product:
    Product Name: "${product.name}"
    Description: "${product.description || 'N/A'}"
    Category: ${product.subcategory?.category?.name || 'N/A'} > ${product.subcategory?.name || 'N/A'}

    Identify MULTIPLE distinct potential industrial applications for this product. 
    For EACH application identified, extract the following information and provide it as a JSON object within a main JSON array under the key "applications".
    
    Desired structure for each application object:
    {
      "applicationName": "(string) A concise name for the specific application.",
      "industrySector": "(string) The primary industry sector (e.g., 'Automotive', 'Medical Devices', 'Aerospace').",
      "useCaseDescription": "(string) Detailed description of how the product is used.",
      "marketPotential": "(string) Brief analysis of market size, growth, or opportunities.",
      "technicalRequirements": "(string) Key technical specs or needs for the product in this use case.",
      "competitiveLandscape": "(string) Short summary of competitors or alternative solutions."
    }

    Return ONLY a single JSON object containing the "applications" array. Example:
    {
      "applications": [
        { "applicationName": "App 1 Name", ... },
        { "applicationName": "App 2 Name", ... },
        ...
      ]
    }

    Do not include any other text, explanations, or introductions before or after the JSON object.
  `;

  // 3. Call Perplexity AI
  try {
    const completion = await perplexity.chat.completions.create({
      model: PERPLEXITY_MODEL, // Consider 'sonar-large-online' for potentially better results
      messages: [
        {
          role: 'system',
          content: 'You are an AI research assistant specializing in industrial applications. Respond ONLY with the requested JSON object containing an array of application details based on the provided product.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 2000, // Increase tokens to allow for multiple detailed applications
      temperature: 0.4, // Keep temperature low for factual extraction
      // response_format: { type: "json_object" }, // Use if available
    });

    const rawResponse = completion.choices[0]?.message?.content?.trim();
    if (!rawResponse) {
        throw new Error('Perplexity AI did not return a valid response.');
    }

    // 4. Parse and Validate Response
    let parsedJson;
    try {
        const jsonMatch = rawResponse.match(/\{.*\}/s);
        if (!jsonMatch) {
            throw new Error('No JSON object found in the AI response.');
        }
        parsedJson = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
        console.error('Failed to parse JSON response from Perplexity:', rawResponse);
        throw new Error(`Failed to parse AI response as JSON. Error: ${parseError.message}`);
    }

    // Validate the structure
    if (!parsedJson || !Array.isArray(parsedJson.applications)) {
      console.error('Invalid JSON structure received. Expected { applications: [...] }:', parsedJson);
      throw new Error('AI response did not contain the expected \"applications\" array.');
    }

    // Optional: Add more detailed validation for each application object within the array
    const validatedApplications = parsedJson.applications.filter(app => app.applicationName); // Basic check

    if (validatedApplications.length === 0) {
        console.warn('AI returned an applications array, but no valid applications were found after basic validation.', parsedJson.applications);
        // Depending on requirements, maybe throw an error or return empty array
    }
    
    console.log(`Discovered ${validatedApplications.length} potential applications for product ID ${productId}.`);
    return validatedApplications; 

  } catch (error) {
    console.error(`Error discovering applications for product ${productId} with Perplexity:`, error);
    // Rethrow or handle specific errors (like API errors vs parsing errors)
    throw new Error(`Failed to discover applications via AI. ${error.message}`);
  }
};

/**
 * Uses Perplexity AI to find manufacturing companies related to a specific application
 * and the user's product.
 * @param {object} researchData - The IndustrialApplicationResearch object.
 * @param {object} productData - The Product object (our product).
 * @returns {Promise<Array<{name: string, website: string}>>} - An array of potential lead companies.
 */
export const findManufacturingLeads = async (researchData, productData) => {
    if (!perplexity) {
        throw new Error('Perplexity API key not configured. Cannot discover leads.');
    }
    if (!researchData) {
        throw new Error('Research data is required to discover leads.');
    }
     if (!productData) {
        throw new Error('Product data is required to discover relevant leads.');
    }

    // Construct the detailed prompt
    const prompt = `
        Identify manufacturing companies that produce "${researchData.applicationName || 'related systems'}" 
        for the "${researchData.industrySector || 'relevant'}" industry sector.

        These manufacturers are potential customers for components like "${productData.name} (Type: ${productData.subcategory?.name || 'component'})" 
        because they would integrate such components into their systems based on requirements such as: 
        "${researchData.technicalRequirements || 'standard industry requirements'}".

        Focus specifically on the companies *building* these "${researchData.applicationName || 'systems/equipment'}", 
        not the end-users (e.g., operators, consumers) or suppliers of raw materials.

        Provide a list of potential lead companies with their names and websites. 
        Return ONLY a JSON array of objects, where each object has the keys "name" and "website".

        Example JSON output format:
        [
          {"name": "Manufacturing Company A", "website": "https://companya.com"},
          {"name": "System Builder B Inc.", "website": "https://systemb.net"}
        ]

        Return ONLY the JSON array. Do not include any other text before or after the JSON.
    `;

    try {
        const completion = await perplexity.chat.completions.create({
            model: PERPLEXITY_MODEL,
            messages: [
                {
                    role: 'system',
                    content: 'You are an AI assistant specialized in identifying potential B2B manufacturing leads based on product applications and technical requirements. Respond ONLY with the requested JSON array.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            max_tokens: 1500, // Allow for a decent list of companies
            temperature: 0.4, // Lower temperature for more focused, less speculative results
            // response_format: { type: "json_object" }, // Use if model supports enforced JSON array (might require specific structure)
        });

        const rawResponse = completion.choices[0]?.message?.content?.trim();
        if (!rawResponse) {
            throw new Error('Perplexity AI did not return a valid response for lead discovery.');
        }

        // Attempt to parse the JSON array response
        let parsedLeads = [];
        try {
            // Find JSON array in case of extra text
            const jsonMatch = rawResponse.match(/\[\s*\{.*\}\s*\]/s);
            if (!jsonMatch) {
                // Fallback: maybe it returned a single object?
                const singleJsonMatch = rawResponse.match(/\{.*\}/s);
                if (singleJsonMatch) {
                    parsedLeads = [JSON.parse(singleJsonMatch[0])]; // Wrap single object in array
                } else {
                     throw new Error('No JSON array or object found in the AI lead discovery response.');
                }
            } else {
                 parsedLeads = JSON.parse(jsonMatch[0]);
            }
            
            // Basic validation: ensure it's an array and elements have name/website
            if (!Array.isArray(parsedLeads)) {
                throw new Error('Parsed AI response for leads is not an array.');
            }
            // Filter out any invalid entries (e.g., missing name or website)
            parsedLeads = parsedLeads.filter(lead => lead && typeof lead.name === 'string' && typeof lead.website === 'string');

        } catch (parseError) {
            console.error('Failed to parse JSON lead response from Perplexity:', rawResponse);
            throw new Error(`Failed to parse AI lead response as JSON array. Error: ${parseError.message}`);
        }

        return parsedLeads; // Return array of {name, website} objects

    } catch (error) {
        console.error(`Error finding manufacturing leads for research ID ${researchData.id} and product ID ${productData.id}:`, error);
        let message = 'Failed to discover manufacturing leads via AI.';
        if (error.response && error.response.data && error.response.data.detail) {
            message = `Perplexity API Error: ${error.response.data.detail}`;
        }
        if (error.message.includes('Failed to parse AI lead response') || error.message.includes('No JSON array or object found')) {
            message = error.message;
        }
        throw new Error(message);
    }
}; 