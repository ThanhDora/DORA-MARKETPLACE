function crc16(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

function tlv(tag: string, value: string): string {
  return `${tag}${String(value.length).padStart(2, '0')}${value}`;
}

export function generateVietQRPayload(params: {
  bankBin: string;
  accountNumber: string;
  amount: number;
  reference: string;
  merchantName?: string;
  city?: string;
}): string {
  const {
    bankBin,
    accountNumber,
    amount,
    reference,
    merchantName = 'MINI MARKETPLACE',
    city = 'HANOI',
  } = params;

  const merchantAcctInfo = `001A000000${bankBin}${accountNumber}`;
  const amtStr = Math.round(amount).toString();
  const ref = reference.length > 25 ? reference.slice(0, 25) : reference;

  const additionalData = tlv('08', ref);

  let payload = '000201'; // Payload Format Indicator
  payload += '010212'; // Point of Initiation Method (12 = dynamic)

  // Merchant Account Information (tag 38 = A000000727 for NAPAS)
  payload += tlv('38', merchantAcctInfo);

  payload += '5303704'; // Currency (704 = VND)
  payload += tlv('54', amtStr); // Amount
  payload += '5802VN'; // Country Code
  payload += tlv('59', merchantName); // Merchant Name
  payload += tlv('60', city); // Merchant City

  // Additional Data (tag 62)
  payload += tlv('62', additionalData);

  // CRC (tag 63) — last 4 chars placeholder, then compute
  const withoutCRC = payload + '6304';
  const crc = crc16(withoutCRC);

  return withoutCRC + crc;
}
