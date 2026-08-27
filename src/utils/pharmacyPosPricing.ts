import type { Product, SaleItem } from '../types';

export type PharmacySellingLevel = NonNullable<SaleItem['dosageType']>;

export interface PharmacyDoseConfig {
  dosesPerPacket: number;
  tabsPerDose: number;
  tabsPerPacket: number;
  halfDoseTabs: number;
  packetPrice: number;
  fullDosePrice: number;
  halfDosePrice: number;
  tabPrice: number;
  hierarchyLevels: Product['pharmacyUnitLevels'] | null;
  baseUnit: string;
}

export interface PharmacyPosLineSnapshot {
  selectedLevel: PharmacySellingLevel;
  selectedLevelLabel: string;
  selectedLevelQuantity: number;
  unitsPerSelectedLevel: number;
  selectedUnitPrice: number;
  lineTotal: number;
  baseQuantityDeducted: number;
}

const positive = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const getPharmacyDoseConfig = (product: Product): PharmacyDoseConfig => {
  const hierarchyLevels = product.pharmacyUnitLevels?.length ? product.pharmacyUnitLevels : null;
  if (hierarchyLevels) {
    const topLevel = hierarchyLevels[0];
    const doseLevel = hierarchyLevels.find(level => level.id === 'dose') || hierarchyLevels[1] || topLevel;
    const baseLevel = hierarchyLevels[hierarchyLevels.length - 1];
    const tabsPerPacket = positive(topLevel.quantityToBaseUnit || product.conversionToBaseUnit || product.tabsPerPack, 1);
    const tabsPerDose = positive(doseLevel.quantityToBaseUnit || product.tabsPerDose, 1);
    const packetPrice = Number(product.packetPrice ?? product.sellingPrice ?? 0);
    const tabPrice = positive(
      product.tabPrice || product.defaultPricePerBaseUnit || product.inventorySettings?.defaultPricePerBaseUnit,
      packetPrice / tabsPerPacket,
    );
    const fullDosePrice = positive(product.fullDosePrice, tabPrice * tabsPerDose);
    const halfDoseTabs = Math.max(1, Math.ceil(tabsPerDose / 2));
    const halfDosePrice = positive(product.halfDosePrice, tabPrice * halfDoseTabs);
    return {
      dosesPerPacket: tabsPerPacket,
      tabsPerDose,
      tabsPerPacket,
      halfDoseTabs,
      packetPrice,
      fullDosePrice,
      halfDosePrice,
      tabPrice,
      hierarchyLevels,
      baseUnit: product.pharmacyBaseUnit || baseLevel.unit,
    };
  }

  const dosesPerPacket = positive(product.dosesPerPacket || product.pharmacyUnitBreakdown?.stripsPerBox, 1);
  const tabsPerDose = positive(product.tabsPerDose || product.pharmacyUnitBreakdown?.tabletsPerStrip || product.tabsPerPack, 1);
  const tabsPerPacket = positive(product.tabsPerPack, dosesPerPacket * tabsPerDose);
  const halfDoseTabs = Math.max(1, Math.ceil(tabsPerDose / 2));
  const packetPrice = Number(product.packetPrice ?? product.sellingPrice ?? 0);
  const fullDosePrice = positive(product.fullDosePrice, packetPrice / dosesPerPacket);
  const halfDosePrice = positive(product.halfDosePrice, fullDosePrice / 2);
  const tabPrice = positive(product.tabPrice, packetPrice / tabsPerPacket);
  return {
    dosesPerPacket,
    tabsPerDose,
    tabsPerPacket,
    halfDoseTabs,
    packetPrice,
    fullDosePrice,
    halfDosePrice,
    tabPrice,
    hierarchyLevels: null,
    baseUnit: product.pharmacyBaseUnit || product.pharmacyUnitBreakdown?.baseUnit || 'Tab',
  };
};

export const resolvePharmacyPosLine = ({
  product,
  selectedLevel = 'packet',
  tabsSelected,
  quantity = 1,
  discount = 0,
  discountType = 'percent',
}: {
  product: Product;
  selectedLevel?: PharmacySellingLevel;
  tabsSelected?: number;
  quantity?: number;
  discount?: number;
  discountType?: 'percent' | 'cash';
}): PharmacyPosLineSnapshot => {
  const config = getPharmacyDoseConfig(product);
  const hierarchyLevel = config.hierarchyLevels?.find(level => level.id === selectedLevel)
    || (selectedLevel === 'full' || selectedLevel === 'half'
      ? config.hierarchyLevels?.find(level => level.id === 'dose')
      : undefined);

  let unitsPerSelectedLevel = 1;
  let selectedUnitPrice = config.tabPrice;

  if (selectedLevel === 'tabs' || selectedLevel === 'unit') {
    unitsPerSelectedLevel = positive(tabsSelected, 1);
    selectedUnitPrice = config.tabPrice * unitsPerSelectedLevel;
  } else if (selectedLevel === 'packet') {
    unitsPerSelectedLevel = hierarchyLevel
      ? positive(hierarchyLevel.quantityToBaseUnit, config.tabsPerPacket)
      : config.tabsPerPacket;
    selectedUnitPrice = config.packetPrice;
  } else if (selectedLevel === 'half') {
    unitsPerSelectedLevel = config.halfDoseTabs;
    selectedUnitPrice = config.halfDosePrice;
  } else if (selectedLevel === 'full' || selectedLevel === 'dose') {
    unitsPerSelectedLevel = hierarchyLevel
      ? positive(hierarchyLevel.quantityToBaseUnit, config.tabsPerDose)
      : config.tabsPerDose;
    selectedUnitPrice = config.fullDosePrice;
  } else {
    unitsPerSelectedLevel = hierarchyLevel
      ? positive(hierarchyLevel.quantityToBaseUnit, 1)
      : 1;
    selectedUnitPrice = config.tabPrice * unitsPerSelectedLevel;
  }

  const selectedLevelQuantity = positive(quantity, 1);
  const safeDiscount = Math.max(0, Number(discount || 0));
  const discountedUnitPrice = discountType === 'cash'
    ? Math.max(0, selectedUnitPrice - safeDiscount)
    : selectedUnitPrice * (1 - Math.min(100, safeDiscount) / 100);

  return {
    selectedLevel,
    selectedLevelLabel: hierarchyLevel?.unit
      || (selectedLevel === 'packet' ? 'Packet'
        : selectedLevel === 'full' ? 'Full Dose'
          : selectedLevel === 'half' ? 'Half Dose'
            : `${unitsPerSelectedLevel} ${config.baseUnit}`),
    selectedLevelQuantity,
    unitsPerSelectedLevel,
    selectedUnitPrice: Number(selectedUnitPrice.toFixed(2)),
    lineTotal: Number((discountedUnitPrice * selectedLevelQuantity).toFixed(2)),
    baseQuantityDeducted: Number((unitsPerSelectedLevel * selectedLevelQuantity).toFixed(3)),
  };
};
