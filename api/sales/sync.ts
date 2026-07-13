export default function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      success: false,
      onlineOnly: true,
      message: 'Offline sales sync is disabled. Use POST only for preserved legacy queue checks.'
    });
  }

  const sales = Array.isArray(req.body?.sales) ? req.body.sales : [];
  console.warn(
    `[Cloud POS API] Online-only mode blocked ${sales.length} offline transaction(s). ` +
      'Nothing was written or deleted; local pending records must be reviewed manually.'
  );

  return res.status(409).json({
    success: false,
    onlineOnly: true,
    queuedPreserved: true,
    message:
      'Offline sales sync is disabled. Pending local records were preserved and must be reviewed manually.'
  });
}
