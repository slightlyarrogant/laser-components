const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')
const Papa = require('papaparse')
const bcrypt = require('bcrypt')

const prisma = new PrismaClient()

const productsCsvPath = path.join(__dirname, '..', 'products', 'Products-Grid view.csv')

const SALT_ROUNDS = 10

async function main () {
  console.log(`Starting seeding...`)

  // --- Seed Admin User ---
  console.log('Upserting admin user...')
  try {
    const adminEmail = 'admin@example.com'
    const adminPassword = 'admin'
    const hashedPassword = await bcrypt.hash(adminPassword, SALT_ROUNDS)

    const adminUser = await prisma.user.upsert({
      where: { email: adminEmail },
      update: { 
        password_hash: hashedPassword,
        role: 'ADMIN' 
      },
      create: {
        email: adminEmail,
        password_hash: hashedPassword,
        role: 'ADMIN'
      }
    })
    console.log(`Admin user upserted successfully: ${adminUser.email}`)
  } catch (error) {
    console.error("Error upserting admin user:", error)
    throw new Error('Failed to upsert admin user.') 
  }

  // --- Seed Products from CSV ---
  console.log(`Seeding products from ${productsCsvPath}...`)

  // 1. Read and Parse CSV
  const fileContent = fs.readFileSync(productsCsvPath, 'utf8')
  const parseResult = Papa.parse(fileContent, {
    header: true,
    skipEmptyLines: true
    // dynamicTyping: true // Be careful with dynamic typing, might convert IDs incorrectly
  })

  if (parseResult.errors.length > 0) {
    console.error('CSV Parsing errors:', parseResult.errors)
    throw new Error('Failed to parse CSV file.')
  }

  const rows = parseResult.data
  console.log(`Parsed ${rows.length} rows from CSV.`) 

  // 2. Process and Upsert Categories
  console.log('Upserting categories...')
  const categoriesMap = new Map()
  for (const row of rows) {
    const categoryName = row['Category Name']?.trim()
    if (categoryName && !categoriesMap.has(categoryName)) {
      const category = await prisma.category.upsert({
        where: { name: categoryName },
        update: { description: row['Category Description']?.trim() }, // Update description if exists
        create: {
          name: categoryName,
          description: row['Category Description']?.trim()
        }
      })
      categoriesMap.set(categoryName, category.id)
      // console.log(`Upserted category: ${category.name} (ID: ${category.id})`)
    }
  }
  console.log(`Processed ${categoriesMap.size} unique categories.`) 

  // 3. Process and Upsert Subcategories
  console.log('Upserting subcategories...')
  const subcategoriesMap = new Map() // Key: categoryId_subcategoryName, Value: subcategoryId
  for (const row of rows) {
    const categoryName = row['Category Name']?.trim()
    const subcategoryName = row['Subcategory Name']?.trim()
    const categoryId = categoriesMap.get(categoryName)

    if (categoryId && subcategoryName) {
      const mapKey = `${categoryId}_${subcategoryName}`
      if (!subcategoriesMap.has(mapKey)) {
        const subcategory = await prisma.subcategory.upsert({
          where: { categoryId_name: { categoryId, name: subcategoryName } }, // Uses @@unique constraint
          update: { description: row['Subcategory Description']?.trim() },
          create: {
            name: subcategoryName,
            description: row['Subcategory Description']?.trim(),
            categoryId
          }
        })
        subcategoriesMap.set(mapKey, subcategory.id)
        // console.log(`Upserted subcategory: ${subcategory.name} (ID: ${subcategory.id}) under Category ID: ${categoryId}`)
      }
    }
  }
   console.log(`Processed ${subcategoriesMap.size} unique subcategories.`) 

  // 4. Process Products
  console.log('Preparing products for creation...')
  const productsToCreate = []
  let skippedProductCount = 0
  for (const row of rows) {
    const categoryName = row['Category Name']?.trim()
    const subcategoryName = row['Subcategory Name']?.trim()
    const productName = row['Product Name']?.trim()
    const categoryId = categoriesMap.get(categoryName)
    const subcategoryMapKey = `${categoryId}_${subcategoryName}`
    const subcategoryId = subcategoriesMap.get(subcategoryMapKey)

    if (productName && subcategoryId) {
      productsToCreate.push({
        name: productName,
        description: row['Product Description']?.trim() || row['Product Subheader']?.trim(), // Use Description or Subheader
        subcategoryId, // Found via lookup
        sku: null, // As requested
        price: null, // As requested
        specifications: null, // As requested
        datasheetUrl: row['Product URL']?.trim() // As requested
      })
    } else {
        // console.warn(`Skipping product row due to missing name or subcategory mapping: ${JSON.stringify(row)}`)
        skippedProductCount++
    }
  }
  console.log(`Prepared ${productsToCreate.length} products for creation. Skipped ${skippedProductCount} rows.`) 

  // 5. Bulk Create Products (Handle potential duplicates if needed, e.g., based on name+subcategoryId)
  // Using createMany might be faster but won't report individual errors easily.
  // Looping with upsert is safer for handling potential duplicates or updates.
  console.log('Creating products...')
  let createdCount = 0
  let errorCount = 0
  for (const productData of productsToCreate) {
      try {
          await prisma.product.upsert({
              where: { 
                  // Use the name for the automatically generated compound unique index
                  name_subcategoryId: { 
                      name: productData.name, 
                      subcategoryId: productData.subcategoryId 
                  }
              },
              update: productData, // Update all fields if found
              create: productData
          });
          createdCount++;
      } catch (error) {
          // Log errors but continue processing other products
          console.error(`Failed to upsert product ${productData.name}:`, error.message);
          errorCount++;
      }
  }
   // Alternative: Faster createMany (less safe for duplicates/updates)
  // if (productsToCreate.length > 0) {
  //   const result = await prisma.product.createMany({
  //     data: productsToCreate,
  //     skipDuplicates: true, // Skips if unique constraints fail (e.g., SKU if it were unique and present)
  //   })
  //   console.log(`Created ${result.count} products.`)
  // } else {
  //   console.log('No valid products found to create.')
  // }


  console.log(`Seeding finished. Created ${createdCount} products. Encountered ${errorCount} errors during product creation.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 