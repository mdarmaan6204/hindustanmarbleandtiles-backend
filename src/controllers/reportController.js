import Product from '../models/Product.js';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

// Helper function to format quantity
const formatQuantity = (boxes, pieces) => {
  if (boxes > 0 && pieces > 0) {
    return `${boxes} bx, ${pieces} p`;
  } else if (boxes > 0) {
    return `${boxes} bx`;
  } else if (pieces > 0) {
    return `${pieces} p`;
  }
  return '0';
};

// Helper function to calculate available stock
const calculateAvailable = (product) => {
  const stockBoxes = product.stock?.boxes || 0;
  const stockPieces = product.stock?.pieces || 0;
  const salesBoxes = product.sales?.boxes || 0;
  const salesPieces = product.sales?.pieces || 0;
  const damageBoxes = product.damage?.boxes || 0;
  const damagePieces = product.damage?.pieces || 0;
  const returnBoxes = product.returns?.boxes || 0;
  const returnPieces = product.returns?.pieces || 0;
  
  const piecesPerBox = product.piecesPerBox || 1;
  
  // Convert everything to pieces for calculation
  const totalStockPieces = (stockBoxes * piecesPerBox) + stockPieces;
  const totalSalesPieces = (salesBoxes * piecesPerBox) + salesPieces;
  const totalDamagePieces = (damageBoxes * piecesPerBox) + damagePieces;
  const totalReturnPieces = (returnBoxes * piecesPerBox) + returnPieces;
  
  // Available = Stock - Sales - Damage + Returns
  const availablePieces = totalStockPieces - totalSalesPieces - totalDamagePieces + totalReturnPieces;
  
  // Convert back to boxes and pieces
  const boxes = Math.floor(availablePieces / piecesPerBox);
  const pieces = availablePieces % piecesPerBox;
  
  return { boxes, pieces, totalPieces: availablePieces };
};

// Generate PDF Report
export const generateProductPDF = async (req, res) => {
  try {
    const { 
      type, 
      size, 
      hsn, 
      location, 
      search,
      dateFrom,
      dateTo 
    } = req.query;

    // Build filter query
    let query = {};
    
    if (type) query.type = type;
    if (size) query.size = size;
    if (hsn) query.hsnNo = hsn;
    if (location) query.location = location;
    if (search) {
      query.productName = { $regex: search, $options: 'i' };
    }
    
    // Date range filter
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        query.createdAt.$gte = fromDate;
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = toDate;
      }
    }

    // Fetch products
    const products = await Product.find(query).sort({ createdAt: -1 });

    // Create PDF document
    const doc = new PDFDocument({ 
      size: 'A4',
      margin: 40,
      bufferPages: true
    });

    // Set response headers for inline display (opens in new tab)
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="Product_List.pdf"');

    // Pipe PDF to response
    doc.pipe(res);

    const printTime = new Date().toLocaleString('en-GB', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: true 
    });
    const currentDate = new Date().toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });

    // Function to add header to each page
    const addHeader = (pageNum, isFirstPage = false) => {
      if (isFirstPage) {
        // First page with company title
        doc.fontSize(20).font('Helvetica-Bold').text('HINDUSTAN MARBLE & TILES', 40, 55, { align: 'center', width: 515 });
        doc.fontSize(14).text(`Stock Report (Till ${currentDate})`, 40, 80, { align: 'center', width: 515 });
        
        // Page number on LEFT
        doc.fontSize(10).font('Helvetica');
        doc.text(`Page ${pageNum}`, 40, 40, { align: 'left' });
        
        // Print info on RIGHT
        doc.text(`Printed on: ${printTime}`, 40, 40, { align: 'right', width: 515 });
        doc.text(`Total Products: ${products.length}`, 40, 52, { align: 'right', width: 515 });
        
        doc.y = 100;
      } else {
        // Subsequent pages - no title, just page info and table
        // Page number on LEFT
        doc.fontSize(10).font('Helvetica');
        doc.text(`Page ${pageNum}`, 40, 40, { align: 'left' });
        
        // Print info on RIGHT
        doc.text(`Printed on: ${printTime}`, 40, 40, { align: 'right', width: 515 });
        doc.text(`Total Products: ${products.length}`, 40, 52, { align: 'right', width: 515 });
        
        doc.y = 70;
      }
    };

    // Add first page header
    let currentPageNum = 1;
    addHeader(currentPageNum, true);
    
    // Filters removed from PDF as per requirement
    
    doc.moveDown(0.5);

    // Table header
    const tableTop = doc.y;
    const rowHeight = 35; // Increased for two lines (product name + type)
    const colWidths = {
      no: 25,
      name: 110,     // Product name with type below
      hsn: 50,       // HSN code column
      stock: 48,
      sales: 43,
      damage: 48,
      returns: 48,
      available: 58,
      location: 55
    };

    // Function to draw table header
    const drawTableHeader = () => {
      const headerY = doc.y;
      
      // Header background
      doc.rect(40, headerY, 515, 26).fill('#2563eb');
      
      // Header text
      doc.fill('#ffffff').fontSize(10).font('Helvetica-Bold');
      let xPos = 42;
      doc.text('S.No.', xPos, headerY + 8, { width: colWidths.no, align: 'left' });
      xPos += colWidths.no;
      doc.text('Product Name', xPos, headerY + 8, { width: colWidths.name, align: 'left' });
      xPos += colWidths.name;
      doc.text('HSN Code', xPos, headerY + 8, { width: colWidths.hsn, align: 'left' });
      xPos += colWidths.hsn;
      doc.text('Stock', xPos, headerY + 8, { width: colWidths.stock, align: 'left' });
      xPos += colWidths.stock;
      doc.text('Sales', xPos, headerY + 8, { width: colWidths.sales, align: 'left' });
      xPos += colWidths.sales;
      doc.text('Damage', xPos, headerY + 8, { width: colWidths.damage, align: 'left' });
      xPos += colWidths.damage;
      doc.text('Returns', xPos, headerY + 8, { width: colWidths.returns, align: 'left' });
      xPos += colWidths.returns;
      doc.text('Available', xPos, headerY + 8, { width: colWidths.available, align: 'left' });
      xPos += colWidths.available;
      doc.text('Location', xPos, headerY + 8, { width: colWidths.location, align: 'left' });
      
      doc.y = headerY + 26;
    };

    // Draw initial table header
    drawTableHeader();

    // Table rows
    doc.font('Helvetica').fontSize(10); // Increased to 10
    products.forEach((product, index) => {
      const available = calculateAvailable(product);
      
      // Check if we need a new page (leave space for at least one row + footer)
      if (doc.y > 750) {
        doc.addPage();
        currentPageNum++;
        addHeader(currentPageNum, false); // false = no title on subsequent pages
        drawTableHeader();
      }

      const yPos = doc.y;

      // Alternating row colors with consistent height
      if (index % 2 === 0) {
        doc.rect(40, yPos, 515, rowHeight).fill('#f9fafb');
      } else {
        doc.rect(40, yPos, 515, rowHeight).fill('#ffffff');
      }

      doc.fill('#000000').font('Helvetica').fontSize(10); // Font size 10
      let xPos = 42;
      
      // S.No.
      doc.text(`${index + 1}`, xPos, yPos + 10, { width: colWidths.no, align: 'left' });
      xPos += colWidths.no;
      
      // Product Name - on first line, bold
      doc.font('Helvetica-Bold').fontSize(10);
      doc.text(product.productName, xPos, yPos + 5, { 
        width: colWidths.name, 
        align: 'left',
        ellipsis: true,
        lineBreak: false
      });
      // Type-SubType - on second line, smaller font
      const typeText = product.subType ? `${product.type} - ${product.subType}` : product.type;
      doc.font('Helvetica').fontSize(7);
      doc.text(typeText, xPos, yPos + 19, { 
        width: colWidths.name, 
        align: 'left',
        ellipsis: true,
        lineBreak: false
      });
      xPos += colWidths.name;
      
      // HSN Code
      doc.font('Helvetica').fontSize(9);
      doc.text(product.hsnNo || '-', xPos, yPos + 10, { 
        width: colWidths.hsn, 
        align: 'left' 
      });
      xPos += colWidths.hsn;
      
      // Reset to normal font for remaining columns
      doc.font('Helvetica').fontSize(10);
      
      // Stock
      doc.text(formatQuantity(product.stock?.boxes, product.stock?.pieces), xPos, yPos + 10, { 
        width: colWidths.stock, 
        align: 'left' 
      });
      xPos += colWidths.stock;
      
      // Sales
      doc.text(formatQuantity(product.sales?.boxes, product.sales?.pieces), xPos, yPos + 10, { 
        width: colWidths.sales, 
        align: 'left' 
      });
      xPos += colWidths.sales;
      
      // Damage
      doc.text(formatQuantity(product.damage?.boxes, product.damage?.pieces), xPos, yPos + 10, { 
        width: colWidths.damage, 
        align: 'left' 
      });
      xPos += colWidths.damage;
      
      // Returns
      doc.text(formatQuantity(product.returns?.boxes, product.returns?.pieces), xPos, yPos + 10, { 
        width: colWidths.returns, 
        align: 'left' 
      });
      xPos += colWidths.returns;
      
      // Available - in GREEN color
      doc.fillColor('#16a34a').font('Helvetica-Bold');
      doc.text(formatQuantity(available.boxes, available.pieces), xPos, yPos + 10, { 
        width: colWidths.available, 
        align: 'left' 
      });
      doc.fillColor('#000000').font('Helvetica');
      xPos += colWidths.available;
      
      // Location
      doc.text(product.location || '-', xPos, yPos + 10, { 
        width: colWidths.location, 
        align: 'left'
      });

      doc.y = yPos + rowHeight;
    });

    // Finalize PDF
    doc.end();

  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ 
      message: 'Error generating PDF report', 
      error: error.message 
    });
  }
};

// Generate Excel Report
export const generateProductExcel = async (req, res) => {
  try {
    const { 
      type, 
      size, 
      hsn, 
      location, 
      search,
      dateFrom,
      dateTo 
    } = req.query;

    // Build filter query
    let query = {};
    
    if (type) query.type = type;
    if (size) query.size = size;
    if (hsn) query.hsnNo = hsn;
    if (location) query.location = location;
    if (search) {
      query.productName = { $regex: search, $options: 'i' };
    }
    
    // Date range filter
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        query.createdAt.$gte = fromDate;
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = toDate;
      }
    }

    // Fetch products
    const products = await Product.find(query).sort({ createdAt: -1 });

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Product List');

    // Set column widths
    worksheet.columns = [
      { header: 'S.No.', key: 'no', width: 8 },
      { header: 'Product Name', key: 'name', width: 30 },
      { header: 'Type', key: 'type', width: 20 },
      { header: 'HSN Number', key: 'hsn', width: 15 },
      { header: 'Location', key: 'location', width: 15 },
      { header: 'Stock (Boxes)', key: 'stockBoxes', width: 15 },
      { header: 'Stock (Pieces)', key: 'stockPieces', width: 15 },
      { header: 'Sales (Boxes)', key: 'salesBoxes', width: 15 },
      { header: 'Sales (Pieces)', key: 'salesPieces', width: 15 },
      { header: 'Damage (Boxes)', key: 'damageBoxes', width: 15 },
      { header: 'Damage (Pieces)', key: 'damagePieces', width: 15 },
      { header: 'Returns (Boxes)', key: 'returnsBoxes', width: 15 },
      { header: 'Returns (Pieces)', key: 'returnsPieces', width: 15 },
      { header: 'Available (Boxes)', key: 'availBoxes', width: 15 },
      { header: 'Available (Pieces)', key: 'availPieces', width: 15 },
      { header: 'Pieces Per Box', key: 'piecesPerBox', width: 15 },
      { header: 'Added Date', key: 'createdAt', width: 20 }
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' }
    };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).height = 25;

    // Add data rows
    products.forEach((product, index) => {
      const available = calculateAvailable(product);
      const typeText = product.subType ? `${product.type} - ${product.subType}` : product.type;
      
      worksheet.addRow({
        no: index + 1,
        name: product.productName,
        type: typeText,
        hsn: product.hsnNo || '-',
        location: product.location || '-',
        stockBoxes: product.stock?.boxes || 0,
        stockPieces: product.stock?.pieces || 0,
        salesBoxes: product.sales?.boxes || 0,
        salesPieces: product.sales?.pieces || 0,
        damageBoxes: product.damage?.boxes || 0,
        damagePieces: product.damage?.pieces || 0,
        returnsBoxes: product.returns?.boxes || 0,
        returnsPieces: product.returns?.pieces || 0,
        availBoxes: available.boxes,
        availPieces: available.pieces,
        piecesPerBox: product.piecesPerBox,
        createdAt: new Date(product.createdAt).toLocaleString('en-IN')
      });
    });

    // Alternate row colors
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1 && rowNumber % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF9FAFB' }
        };
      }
    });

    // Set response headers
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Product_List_${Date.now()}.xlsx"`
    );

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error generating Excel:', error);
    res.status(500).json({ 
      message: 'Error generating Excel report', 
      error: error.message 
    });
  }
};
