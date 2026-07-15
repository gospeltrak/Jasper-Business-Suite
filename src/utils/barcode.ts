const buildEan13 = () => {
  const digits = Array.from({ length: 12 }, (_, index) => (
    index === 0
      ? Math.floor(1 + Math.random() * 9)
      : Math.floor(Math.random() * 10)
  ));
  const weightedSum = digits.reduce(
    (sum, digit, index) => sum + digit * (index % 2 === 0 ? 1 : 3),
    0,
  );
  const checkDigit = (10 - (weightedSum % 10)) % 10;
  return `${digits.join('')}${checkDigit}`;
};

export const generateUniqueEan13Barcode = (existingCodes: Iterable<string | null | undefined>) => {
  const usedCodes = new Set(
    Array.from(existingCodes, code => String(code || '').trim()).filter(Boolean),
  );

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const barcode = buildEan13();
    if (!usedCodes.has(barcode)) return barcode;
  }

  throw new Error('Could not generate a unique barcode. Please try again.');
};
