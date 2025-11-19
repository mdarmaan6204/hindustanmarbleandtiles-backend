/**
 * Inventory Utility Functions - Backend
 * Handles dual-unit (boxes + pieces) inventory calculations
 */

// =====================================================
// 1. Get Pieces Per Box for a given size
// =====================================================
export function getPiecesPerBox(size, userChoice = null) {
  const mapping = {
    "1×1": 9,
    "1×1.5": 6,
    "1×2": userChoice || 6, // Default to 6, but user can select 5 or 6
    "2×2": 4,
    "2×4": 2,
    "16×16": 5
  };
  
  return mapping[size] || null;
}

// =====================================================
// 2. Normalize total pieces to {boxes, pieces} format
// =====================================================
export function normalizePieces(totalPieces, piecesPerBox) {
  if (totalPieces < 0) {
    throw new Error("Cannot normalize negative pieces");
  }
  
  const boxes = Math.floor(totalPieces / piecesPerBox);
  const pieces = totalPieces % piecesPerBox;
  
  return { boxes, pieces };
}

// =====================================================
// 3. Convert {boxes, pieces} to total pieces
// =====================================================
export function toTotalPieces(boxes, pieces, piecesPerBox) {
  if (boxes < 0 || pieces < 0) {
    throw new Error("Cannot have negative boxes or pieces");
  }
  
  // Instead of throwing error, normalize if pieces >= piecesPerBox
  // This handles cases where data was saved incorrectly
  if (pieces >= piecesPerBox) {
    const extraBoxes = Math.floor(pieces / piecesPerBox);
    const remainingPieces = pieces % piecesPerBox;
    return ((boxes + extraBoxes) * piecesPerBox) + remainingPieces;
  }
  
  return (boxes * piecesPerBox) + pieces;
}

// =====================================================
// 4. Calculate available quantity
// =====================================================
export function calculateAvailable(product) {
  if (!product.stock || !product.sales || !product.damage) {
    return { boxes: 0, pieces: 0, totalPieces: 0 };
  }

  const stockTotal = toTotalPieces(
    product.stock.boxes || 0,
    product.stock.pieces || 0,
    product.piecesPerBox || 1
  );
  
  const salesTotal = toTotalPieces(
    product.sales?.boxes || 0,
    product.sales?.pieces || 0,
    product.piecesPerBox || 1
  );
  
  const damageTotal = toTotalPieces(
    product.damage?.boxes || 0,
    product.damage?.pieces || 0,
    product.piecesPerBox || 1
  );
  
  const returnsTotal = toTotalPieces(
    product.returns?.boxes || 0,
    product.returns?.pieces || 0,
    product.piecesPerBox || 1
  );
  
  const availableTotal = stockTotal - salesTotal - damageTotal + returnsTotal;
  
  if (availableTotal < 0) {
    return { boxes: 0, pieces: 0, totalPieces: 0 };
  }
  
  const normalized = normalizePieces(availableTotal, product.piecesPerBox || 1);
  
  return {
    boxes: normalized.boxes,
    pieces: normalized.pieces,
    totalPieces: availableTotal
  };
}

// =====================================================
// 5. Validate quantity before sale/damage/return
// =====================================================
export function validateQuantity(totalPiecesNeeded, availableTotalPieces, operation = "sale") {
  const operationLabel = {
    "sale": "sale",
    "damage": "damage",
    "return": "return"
  };
  
  const label = operationLabel[operation] || operation;
  
  if (totalPiecesNeeded < 0) {
    return {
      isValid: false,
      message: `Cannot ${label} negative quantity`
    };
  }
  
  if (totalPiecesNeeded === 0) {
    return {
      isValid: false,
      message: `Must ${label} at least 1 piece`
    };
  }
  
  if (totalPiecesNeeded > availableTotalPieces) {
    return {
      isValid: false,
      message: `Insufficient quantity. Available: ${availableTotalPieces} pc, Needed: ${totalPiecesNeeded} pc`
    };
  }
  
  return {
    isValid: true,
    message: `Valid for ${label}`
  };
}

// =====================================================
// 6. Get availability status
// =====================================================
export function getAvailabilityStatus(availableTotalPieces, piecesPerBox) {
  if (availableTotalPieces === 0) {
    return "out_of_stock";
  }
  
  const availableBoxes = Math.floor(availableTotalPieces / piecesPerBox);
  
  if (availableBoxes >= 3) {
    return "good";
  } else if (availableBoxes >= 1) {
    return "low";
  } else {
    return "critical";
  }
}

// =====================================================
// 7. Validate boxes and pieces format
// =====================================================
export function validateBoxesPieces(boxes, pieces, piecesPerBox) {
  if (boxes < 0 || pieces < 0) {
    return {
      isValid: false,
      message: "Boxes and pieces cannot be negative"
    };
  }
  
  if (pieces >= piecesPerBox) {
    return {
      isValid: false,
      message: `Pieces must be less than ${piecesPerBox}`
    };
  }
  
  return {
    isValid: true,
    message: "Valid format"
  };
}

// =====================================================
// 8. Parse user input (boxes or pieces)
// =====================================================
export function parseDualUnitInput(inputValue, inputType, piecesPerBox) {
  if (inputValue <= 0) {
    throw new Error("Input value must be positive");
  }
  
  let totalPieces;
  
  if (inputType === "boxes") {
    totalPieces = inputValue * piecesPerBox;
  } else if (inputType === "pieces") {
    totalPieces = inputValue;
  } else {
    throw new Error("Invalid input type");
  }
  
  const normalized = normalizePieces(totalPieces, piecesPerBox);
  
  return {
    boxes: normalized.boxes,
    pieces: normalized.pieces,
    totalPieces
  };
}

// =====================================================
// 9. Calculate damage percentage
// =====================================================
export function calculateDamagePercentage(damageTotalPieces, stockTotalPieces) {
  if (stockTotalPieces === 0) {
    return 0;
  }
  
  const percentage = (damageTotalPieces / stockTotalPieces) * 100;
  return Math.round(percentage * 10) / 10; // Round to 1 decimal
}

// =====================================================
// 10. Calculate return rate
// =====================================================
export function calculateReturnRate(returnsTotalPieces, salesTotalPieces) {
  if (salesTotalPieces === 0) {
    return 0;
  }
  
  const percentage = (returnsTotalPieces / salesTotalPieces) * 100;
  return Math.round(percentage * 10) / 10;
}
