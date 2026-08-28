// =====================================================
// ABLE — Office File Parser (.docx, .xlsx, .pptx)
// Extracts text from Office Open XML formats for
// sensitive data scanning.
// =====================================================

// --- Format detection ---

const OFFICE_FORMATS = {
  docx: {
    extensions: ['.docx'],
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  },
  xlsx: {
    extensions: ['.xlsx'],
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
  },
  pptx: {
    extensions: ['.pptx'],
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
  },
};

function detectOfficeFormat(file) {
  const name = file.name.toLowerCase();
  const mime = file.type;

  for (const [format, config] of Object.entries(OFFICE_FORMATS)) {
    if (config.extensions.some(ext => name.endsWith(ext))) {
      return format;
    }
    if (config.mimeTypes.includes(mime)) {
      return format;
    }
  }
  return null;
}

// --- Inline DEFLATE decoder (RFC 1951) fallback ---
// Used when native DecompressionStream is not available.
// Minimal implementation — handles the DEFLATE streams found in Office files.

function inflate(data) {
  const output = [];
  let inp = 0;
  const bits = { value: 0, count: 0 };

  function readBit() {
    if (bits.count === 0) {
      bits.value = data[inp++];
      bits.count = 8;
    }
    const b = (bits.value >> (8 - bits.count)) & 1;
    bits.count--;
    return b;
  }

  function readBits(n) {
    let v = 0;
    for (let i = 0; i < n; i++) {
      v |= readBit() << i;
    }
    return v;
  }

  function readHuffmanTable(codeLengths) {
    const maxLen = Math.max(...codeLengths);
    const blCount = new Array(maxLen + 1).fill(0);
    for (const len of codeLengths) {
      if (len > 0) blCount[len]++;
    }

    let code = 0;
    const nextCode = new Array(maxLen + 1).fill(0);
    for (let bits = 1; bits <= maxLen; bits++) {
      code = (code + blCount[bits - 1]) << 1;
      nextCode[bits] = code;
    }

    const table = {};
    for (let i = 0; i < codeLengths.length; i++) {
      const len = codeLengths[i];
      if (len === 0) continue;
      const c = nextCode[len]++;
      table[c] = i;
    }
    return { table, maxLen };
  }

  function readSymbol(table, maxLen) {
    let code = 0;
    for (let i = 0; i < maxLen; i++) {
      code = (code << 1) | readBit();
      if (code in table) return table[code];
    }
    throw new Error('Invalid Huffman code');
  }

  // Fixed Huffman tables (RFC 1951 section 3.2.6)
  function buildFixedLitLenTable() {
    const lengths = new Array(288).fill(0);
    for (let i = 0; i <= 143; i++) lengths[i] = 8;
    for (let i = 144; i <= 255; i++) lengths[i] = 9;
    for (let i = 256; i <= 279; i++) lengths[i] = 7;
    for (let i = 280; i <= 287; i++) lengths[i] = 8;
    return buildHuffmanTable(lengths);
  }

  function buildFixedDistTable() {
    const lengths = new Array(32).fill(5);
    return buildHuffmanTable(lengths);
  }

  function buildHuffmanTable(lengths) {
    const maxLen = Math.max(...lengths);
    const blCount = new Array(maxLen + 1).fill(0);
    for (const len of lengths) {
      if (len > 0) blCount[len]++;
    }

    let code = 0;
    const nextCode = new Array(maxLen + 1).fill(0);
    for (let bits = 1; bits <= maxLen; bits++) {
      code = (code + blCount[bits - 1]) << 1;
      nextCode[bits] = code;
    }

    const table = {};
    for (let i = 0; i < lengths.length; i++) {
      const len = lengths[i];
      if (len === 0) continue;
      const c = nextCode[len]++;
      table[c] = i;
    }
    return { table, maxLen };
  }

  const lengthBase = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  const extraLengthBits = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  const distBase = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  const extraDistBits = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];

  readBits(2); // final block flag not needed — we process all blocks

  const litLenTable = buildFixedLitLenTable();
  const distTable = buildFixedDistTable();

  // We only handle fixed Huffman blocks (type 1), which is what Office files use
  // Skip block type bits since we assume fixed Huffman
  // Actually, we need to read block type properly
  // Reset bit reader for proper block header parsing
  // Re-parse from start with proper block handling
  const buffer = data;
  const result = [];
  let pos = 0;
  let bitBuf = 0;
  let bitCount = 0;

  function readBit2() {
    if (bitCount === 0) {
      bitBuf = buffer[pos++];
      bitCount = 8;
    }
    return (bitBuf >> --bitCount) & 1;
  }

  function readBits2(n) {
    let v = 0;
    for (let i = 0; i < n; i++) {
      v |= readBit2() << i;
    }
    return v;
  }

  pos = 0;
  bitBuf = 0;
  bitCount = 0;

  // Bit-reversed read for Huffman (MSB-first as stored in DEFLATE)
  function readBitMSB() {
    if (bitCount === 0) {
      bitBuf = buffer[pos++];
      bitCount = 8;
    }
    return (bitBuf >> (8 - bitCount--)) & 1;
  }

  function readBitsMSB(n) {
    let v = 0;
    for (let i = 0; i < n; i++) {
      v = (v << 1) | readBitMSB();
    }
    return v;
  }

  // Reset and use MSB-first for proper DEFLATE reading
  pos = 0;
  bitBuf = 0;
  bitCount = 0;

  let isFinal = 0;
  while (!isFinal) {
    isFinal = readBitsMSB(1);
    const blockType = readBitsMSB(2);

    if (blockType === 0) {
      // Stored (uncompressed) block — skip to byte boundary
      bitCount = 0;
      const len = (buffer[pos++] | (buffer[pos++] << 8));
      pos += 2; // skip nlen (one's complement)
      for (let i = 0; i < len; i++) {
        result.push(buffer[pos++]);
      }
      continue;
    }

    if (blockType === 1) {
      // Fixed Huffman codes
      const lit = buildHuffmanTable((() => {
        const l = new Array(288).fill(0);
        for (let i = 0; i <= 143; i++) l[i] = 8;
        for (let i = 144; i <= 255; i++) l[i] = 9;
        for (let i = 256; i <= 279; i++) l[i] = 7;
        for (let i = 280; i <= 287; i++) l[i] = 8;
        return l;
      })());
      const dist = buildHuffmanTable(new Array(32).fill(5));

      while (true) {
        const sym = readSymbol(lit.table, lit.maxLen);
        if (sym < 256) {
          result.push(sym);
        } else if (sym === 256) {
          break;
        } else {
          const lenIdx = sym - 257;
          const length = lengthBase[lenIdx] + readBits2(extraLengthBits[lenIdx]);
          const distSym = readSymbol(dist.table, dist.maxLen);
          const distance = distBase[distSym] + readBits2(extraDistBits[distSym]);
          const start = result.length - distance;
          for (let i = 0; i < length; i++) {
            result.push(result[start + i]);
          }
        }
      }
      continue;
    }

    if (blockType === 2) {
      // Dynamic Huffman codes
      const numLit = readBitsMSB(5) + 257;
      const numDist = readBitsMSB(5) + 1;
      const numCodeLen = readBitsMSB(4) + 4;

      const codeLengthOrder = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
      const codeLengths = new Array(19).fill(0);
      for (let i = 0; i < numCodeLen; i++) {
        codeLengths[codeLengthOrder[i]] = readBitsMSB(3);
      }

      const codeTable = buildHuffmanTable(codeLengths);

      const allLengths = [];
      while (allLengths.length < numLit + numDist) {
        const sym = readSymbol(codeTable.table, codeTable.maxLen);
        if (sym < 16) {
          allLengths.push(sym);
        } else if (sym === 16) {
          const repeat = readBitsMSB(2) + 3;
          for (let i = 0; i < repeat; i++) {
            allLengths.push(allLengths[allLengths.length - 1]);
          }
        } else if (sym === 17) {
          const repeat = readBitsMSB(3) + 3;
          for (let i = 0; i < repeat; i++) {
            allLengths.push(0);
          }
        } else if (sym === 18) {
          const repeat = readBitsMSB(7) + 11;
          for (let i = 0; i < repeat; i++) {
            allLengths.push(0);
          }
        }
      }

      const litLengths = allLengths.slice(0, numLit);
      const distLengths = allLengths.slice(numLit, numLit + numDist);
      const litTable = buildHuffmanTable(litLengths);
      const distTable2 = buildHuffmanTable(distLengths);

      while (true) {
        const sym = readSymbol(litTable.table, litTable.maxLen);
        if (sym < 256) {
          result.push(sym);
        } else if (sym === 256) {
          break;
        } else {
          const lenIdx = sym - 257;
          const length = lengthBase[lenIdx] + readBits2(extraLengthBits[lenIdx]);
          const distSym = readSymbol(distTable2.table, distTable2.maxLen);
          const distance = distBase[distSym] + readBits2(extraDistBits[distSym]);
          const start = result.length - distance;
          for (let i = 0; i < length; i++) {
            result.push(result[start + i]);
          }
        }
      }
      continue;
    }

    // Block type 3 is reserved — should not occur
    throw new Error('Invalid DEFLATE block type: 3');
  }

  return new Uint8Array(result);
}

// --- ZIP reader ---

class ZipReader {
  constructor(buffer) {
    this.buffer = buffer;
    this.view = new DataView(buffer);
    this.files = {};
    this._parsed = false;
  }

  parse() {
    if (this._parsed) return;
    this._parsed = true;

    let offset = 0;
    const len = this.buffer.byteLength;

    while (offset < len - 30) {
      // Look for local file header signature: PK\x03\x04 (0x04034b50 LE)
      if (this.view.getUint32(offset, true) !== 0x04034b50) {
        offset++;
        continue;
      }

      const compMethod = this.view.getUint16(offset + 8, true);
      const compSize = this.view.getUint32(offset + 18, true);
      const uncompSize = this.view.getUint32(offset + 22, true);
      const nameLen = this.view.getUint16(offset + 26, true);
      const extraLen = this.view.getUint16(offset + 28, true);

      const nameBytes = new Uint8Array(this.buffer, offset + 30, nameLen);
      const fileName = new TextDecoder().decode(nameBytes);

      // Strip trailing null characters from some ZIP implementations
      const cleanName = fileName.replace(/\0+$/, '');

      if (cleanName) {
        const dataStart = offset + 30 + nameLen + extraLen;
        if (dataStart + compSize <= len) {
          const rawData = new Uint8Array(this.buffer, dataStart, compSize);
          this.files[cleanName] = {
            name: cleanName,
            compressed: compMethod !== 0,
            compressedSize: compSize,
            uncompressedSize: uncompSize,
            data: rawData.slice(0),
          };
        }
      }

      offset += 30 + nameLen + extraLen + compSize;
    }
  }

  hasFile(path) {
    return !!this.files[path];
  }

  async getText(path) {
    const entry = this.files[path];
    if (!entry) {
      throw new Error(`File not found in ZIP: ${path}`);
    }

    let bytes = entry.data;

    if (entry.compressed) {
      bytes = await this._decompress(bytes);
    }

    return new TextDecoder().decode(bytes);
  }

  async _decompress(data) {
    // Try native Compression Streams API first
    if (typeof DecompressionStream !== 'undefined') {
      try {
        const ds = new DecompressionStream('deflate-raw');
        const writer = ds.writable.getWriter();
        writer.write(data);
        writer.close();

        const reader = ds.readable.getReader();
        const chunks = [];
        let totalLen = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          totalLen += value.byteLength;
        }

        const result = new Uint8Array(totalLen);
        let pos = 0;
        for (const chunk of chunks) {
          result.set(new Uint8Array(chunk), pos);
          pos += chunk.byteLength;
        }
        return result;
      } catch (e) {
        // Fall through to inline inflate
        console.warn('ABLE: DecompressionStream failed, using fallback:', e);
      }
    }

    // Fallback: inline DEFLATE decoder
    return inflate(data);
  }
}

// --- XML namespace helpers ---

const NS = {
  w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  s: 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
};

function collectTextContent(doc, tagName, namespace) {
  const parts = [];
  const nodes = doc.getElementsByTagNameNS(namespace, tagName);
  for (const node of nodes) {
    if (node.textContent) {
      parts.push(node.textContent);
    }
  }
  return parts.join(' ');
}

// --- Format extractors ---

async function extractDocxText(zip) {
  const parser = new DOMParser();
  const textParts = [];

  // Main document body
  if (zip.hasFile('word/document.xml')) {
    const xml = await zip.getText('word/document.xml');
    const doc = parser.parseFromString(xml, 'text/xml');
    textParts.push(collectTextContent(doc, 't', NS.w));
  }

  // Headers (header1.xml through header3.xml)
  for (let i = 1; i <= 3; i++) {
    const path = `word/header${i}.xml`;
    if (zip.hasFile(path)) {
      const xml = await zip.getText(path);
      const doc = parser.parseFromString(xml, 'text/xml');
      textParts.push(collectTextContent(doc, 't', NS.w));
    }
  }

  // Footers (footer1.xml through footer3.xml)
  for (let i = 1; i <= 3; i++) {
    const path = `word/footer${i}.xml`;
    if (zip.hasFile(path)) {
      const xml = await zip.getText(path);
      const doc = parser.parseFromString(xml, 'text/xml');
      textParts.push(collectTextContent(doc, 't', NS.w));
    }
  }

  return textParts.filter(Boolean).join(' ');
}

async function extractXlsxText(zip) {
  const parser = new DOMParser();
  const textParts = [];

  // Load shared strings table
  const sharedStrings = [];
  if (zip.hasFile('xl/sharedStrings.xml')) {
    const xml = await zip.getText('xl/sharedStrings.xml');
    const doc = parser.parseFromString(xml, 'text/xml');
    const siItems = doc.getElementsByTagNameNS(NS.s, 'si');
    for (const si of siItems) {
      const texts = si.getElementsByTagNameNS(NS.s, 't');
      const parts = [];
      for (const t of texts) {
        if (t.textContent) parts.push(t.textContent);
      }
      sharedStrings.push(parts.join(''));
    }
  }

  // Enumerate worksheets
  let sheetIndex = 1;
  while (true) {
    const path = `xl/worksheets/sheet${sheetIndex}.xml`;
    if (!zip.hasFile(path)) break;

    const xml = await zip.getText(path);
    const doc = parser.parseFromString(xml, 'text/xml');
    const cells = doc.getElementsByTagNameNS(NS.s, 'c');

    for (const cell of cells) {
      const typeAttr = cell.getAttribute('t');
      const valueEl = cell.getElementsByTagNameNS(NS.s, 'v')[0];
      if (!valueEl || !valueEl.textContent) continue;

      if (typeAttr === 's') {
        // Shared string reference
        const idx = parseInt(valueEl.textContent, 10);
        if (!isNaN(idx) && sharedStrings[idx] !== undefined) {
          textParts.push(sharedStrings[idx]);
        }
      } else if (typeAttr === 'inlineStr') {
        // Inline string
        const isEl = cell.getElementsByTagNameNS(NS.s, 'is')[0];
        if (isEl) {
          const texts = isEl.getElementsByTagNameNS(NS.s, 't');
          for (const t of texts) {
            if (t.textContent) textParts.push(t.textContent);
          }
        }
      } else {
        // Numeric or other type — include as text
        textParts.push(valueEl.textContent);
      }
    }

    sheetIndex++;
  }

  return textParts.filter(Boolean).join(' ');
}

async function extractPptxText(zip) {
  const parser = new DOMParser();
  const textParts = [];

  let slideIndex = 1;
  while (true) {
    const path = `ppt/slides/slide${slideIndex}.xml`;
    if (!zip.hasFile(path)) break;

    const xml = await zip.getText(path);
    const doc = parser.parseFromString(xml, 'text/xml');
    textParts.push(collectTextContent(doc, 't', NS.a));

    slideIndex++;
  }

  return textParts.filter(Boolean).join(' ');
}

// --- Main entry point ---

const MAX_OFFICE_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

async function extractOfficeText(file) {
  const format = detectOfficeFormat(file);
  if (!format) {
    throw new Error(`Unsupported office format: ${file.name}`);
  }

  if (file.size > MAX_OFFICE_FILE_SIZE) {
    throw new Error(
      `File too large for scanning: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB, limit: 50 MB)`
    );
  }

  if (file.size === 0) {
    throw new Error(`File is empty: ${file.name}`);
  }

  // Read as ArrayBuffer (binary)
  const buffer = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file as ArrayBuffer'));
    reader.readAsArrayBuffer(file);
  });

  // SECURITY: Validate ZIP magic bytes (PK\x03\x04) before parsing.
  // This prevents non-Office files from triggering ZIP parser edge cases
  // and ensures we only process genuine Office Open XML archives.
  const view = new Uint8Array(buffer);
  if (view.length < 4 ||
      view[0] !== 0x50 || view[1] !== 0x4b ||
      view[2] !== 0x03 || view[3] !== 0x04) {
    throw new Error(`Invalid Office file signature: ${file.name}`);
  }

  // Parse ZIP structure
  const zip = new ZipReader(buffer);
  zip.parse();

  // Extract text based on format
  let text;
  switch (format) {
    case 'docx':
      text = await extractDocxText(zip);
      break;
    case 'xlsx':
      text = await extractXlsxText(zip);
      break;
    case 'pptx':
      text = await extractPptxText(zip);
      break;
    default:
      throw new Error(`Unknown format: ${format}`);
  }

  return { text, format };
}
