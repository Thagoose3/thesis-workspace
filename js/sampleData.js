/**
 * Sample Academic Data & Minimal Multi-page PDF Generator
 * Initializes realistic Thesis folder hierarchy and sample research papers with rich annotations.
 */

import { createFolder, createPaperFile, createHighlight, createSideNote, createPaperMetadata } from './models.js';

// Creates a valid PDF binary ArrayBuffer with standard fonts and text streams
function createAcademicPDF(title, authors, abstract, pagesContent = []) {
  const pages = [
    {
      title: title,
      subtitle: `${authors} | Academic Research Paper`,
      sections: [
        { heading: 'Abstract', text: abstract },
        ...(pagesContent[0] || [
          { heading: '1. Introduction', text: 'Recent advances in cybersecurity and automated threat detection have highlighted the growing necessity for intelligent, real-time defenses. In distributed and cloud-native environments, modern ransomware strains rapidly escalate privileges and encrypt critical assets before conventional signature-based systems can react. This paper introduces a comprehensive framework designed to mitigate these vulnerabilities through behavioral analysis and autonomous isolation.' },
          { heading: '2. Problem Formulation', text: 'Traditional perimeter security models operate on implicit trust assumptions. When an adversary breaches the outer perimeter, lateral movement often remains undetected for extended periods. Our goal is to achieve sub-second threat categorization with less than 0.05% false positive rate across massive enterprise telemetry datasets.' }
        ])
      ]
    },
    {
      title: `${title} (Cont.)`,
      subtitle: 'System Architecture & Mathematical Formulation',
      sections: pagesContent[1] || [
        { heading: '3. Proposed Architecture', text: 'The core architecture comprises three synchronized components: (1) Kernel-level eBPF Event Collector, (2) Deep Graph Neural Network for sequence anomaly modeling, and (3) Policy Orchestrator for dynamic access revocation. By decoupling ingestion from inference, our pipeline achieves high throughput scaling beyond 100,000 events per second per node.' },
        { heading: '4. Experimental Evaluation', text: 'We evaluated the system against 14 state-of-the-art ransomware families across 5,000 simulated cloud instances. The proposed model detected 99.4% of zero-day ransomware executions within 1.8 seconds of initial disk entropy elevation, outperforming traditional heuristics by 42%.' }
      ]
    },
    {
      title: `${title} (Conclusion)`,
      subtitle: 'Discussion, Limitations & Future Work',
      sections: pagesContent[2] || [
        { heading: '5. Limitations and Discussion', text: 'While our framework demonstrates superior latency and recall, the computational overhead on edge nodes increases memory footprint by approximately 12%. Furthermore, highly obfuscated sleep-wake evasion techniques require continuous monitoring over extended observation windows.' },
        { heading: '6. Conclusion and Future Directions', text: 'In conclusion, proactive behavioral analysis combined with zero-trust isolation provides robust protection for enterprise cloud infrastructures. Future research will explore hardware-accelerated tensor processors and federated learning across multi-tenant clusters.' }
      ]
    }
  ];

  const esc = (str) => str.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

  const objects = [];
  let objCount = 0;
  const newObj = (content) => {
    objCount++;
    objects.push({ id: objCount, content });
    return objCount;
  };

  const fontObj = newObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const fontBoldObj = newObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  const pageObjIds = [];

  for (let i = 0; i < pages.length; i++) {
    const pageData = pages[i];
    let streamText = 'BT\n';
    
    streamText += `/F2 16 Tf\n50 740 Td\n(${esc(pageData.title)}) Tj\n`;
    streamText += `/F1 10 Tf\n0 -20 Td\n(${esc(pageData.subtitle)}) Tj\n`;
    streamText += `0 -10 Td\n(Page ${i + 1} of ${pages.length}) Tj\n`;

    let curY = -35;
    for (const sec of pageData.sections) {
      streamText += `/F2 12 Tf\n0 ${curY} Td\n(${esc(sec.heading)}) Tj\n`;
      streamText += `/F1 10 Tf\n0 -18 Td\n`;

      const words = sec.text.split(' ');
      let line = '';
      for (const w of words) {
        if ((line + ' ' + w).length > 80) {
          streamText += `(${esc(line.trim())}) Tj\n0 -14 Td\n`;
          line = w;
        } else {
          line += (line ? ' ' : '') + w;
        }
      }
      if (line.trim()) {
        streamText += `(${esc(line.trim())}) Tj\n`;
      }
      curY = -25;
    }

    streamText += 'ET';
    const streamLen = streamText.length;
    const contentObj = newObj(`<< /Length ${streamLen} >>\nstream\n${streamText}\nendstream`);
    const pageObj = newObj(`<< /Type /Page /Parent 3 0 R /MediaBox [0 0 612 792] /Contents ${contentObj} 0 R /Resources << /Font << /F1 ${fontObj} 0 R /F2 ${fontBoldObj} 0 R >> >> >>`);
    pageObjIds.push(pageObj);
  }

  const pagesListStr = pageObjIds.map(id => `${id} 0 R`).join(' ');
  const pagesRootObj = newObj(`<< /Type /Pages /Kids [${pagesListStr}] /Count ${pageObjIds.length} >>`);
  const catalogObj = newObj(`<< /Type /Catalog /Pages ${pagesRootObj} 0 R >>`);

  let pdf = '%PDF-1.4\n';
  const xrefOffsets = [0];

  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i];
    xrefOffsets.push(pdf.length);
    pdf += `${obj.id} 0 obj\n${obj.content}\nendobj\n`;
  }

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    const offsetStr = String(xrefOffsets[i]).padStart(10, '0');
    pdf += `${offsetStr} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogObj} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  const buffer = new ArrayBuffer(pdf.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < pdf.length; i++) {
    view[i] = pdf.charCodeAt(i) & 0xff;
  }
  return buffer;
}

export async function populateSampleData(db) {
  const existingFolders = await db.getFolders();
  if (existingFolders && existingFolders.length > 0) {
    return;
  }

  console.log('Initializing Thesis sample research papers and folder hierarchy...');

  // 1. Create Folder Tree
  const fChapter1 = createFolder({ name: 'Chapter 1 - Introduction & Problem Scope', parentId: null });
  const fChapter2 = createFolder({ name: 'Chapter 2 - Literature Review & Related Work', parentId: null });
  const fChapter3 = createFolder({ name: 'Chapter 3 - Proposed Architecture & Design', parentId: null });
  const fChapter4 = createFolder({ name: 'Chapter 4 - Experiments & Empirical Evaluation', parentId: null });

  await db.saveFolder(fChapter1);
  await db.saveFolder(fChapter2);
  await db.saveFolder(fChapter3);
  await db.saveFolder(fChapter4);

  // Subfolders in Chapter 2
  const fSubtopic1 = createFolder({ name: 'Ransomware & Cloud Defense', parentId: fChapter2.id });
  const fSubtopic2 = createFolder({ name: 'Zero-Trust & Access Control', parentId: fChapter2.id });
  const fSubtopic3 = createFolder({ name: 'AI & Anomaly Detection', parentId: fChapter2.id });

  await db.saveFolder(fSubtopic1);
  await db.saveFolder(fSubtopic2);
  await db.saveFolder(fSubtopic3);

  // Paper 1: RansomShield
  const p1Buffer = createAcademicPDF(
    'RansomShield: Deep Behavioral Detection for Cloud Ransomware',
    'Alex Chen, Sarah Jenkins, Kevin Patel',
    'Ransomware threats in multi-tenant cloud ecosystems cause billions in damages. We present RansomShield, a high-throughput runtime monitor that leverages kernel telemetry and Graph Neural Networks to identify zero-day encryption patterns in real time.'
  );

  const file1 = createPaperFile({
    name: 'Chen2024_RansomShield_Detection.pdf',
    folderId: fSubtopic1.id,
    size: p1Buffer.byteLength,
    tags: ['Ransomware', 'CloudSecurity', 'DeepLearning'],
    pdfData: p1Buffer,
    pageCount: 3
  });
  await db.saveFile(file1);

  const meta1 = createPaperMetadata({
    fileId: file1.id,
    title: 'RansomShield: Deep Behavioral Detection for Cloud-Native Ransomware Defense',
    authors: 'Alex Chen, Sarah Jenkins, and Kevin Patel',
    year: '2024',
    journal: 'IEEE Symposium on Security and Privacy (S&P)',
    volume: '45',
    issue: '2',
    pages: '112-128',
    doi: '10.1109/SP.2024.102381',
    publisher: 'IEEE Computer Society',
    abstract: 'We present RansomShield, a lightweight eBPF-driven framework achieving 99.4% zero-day ransomware detection within 1.8 seconds with negligible CPU overhead.',
    contributions: 'Lightweight kernel eBPF stream telemetry + Graph Neural Network capable of detecting 99.4% zero-day ransomware in under 1.8s.',
    limitations: 'Memory footprint increases by 12% on low-spec edge nodes; long sleep-wake evasion cycles require broader evaluation.',
    methodology: 'Dynamic kernel tracing via eBPF + Temporal Graph Attention Networks evaluated on 5,000 cloud instances.',
    findings: 'Outperformed signature heuristics by 42% with false positive rate below 0.03%.'
  });
  await db.saveMetadata(meta1);

  const hl1 = createHighlight({
    fileId: file1.id,
    pageNumber: 1,
    text: 'sub-second threat categorization with less than 0.05% false positive rate',
    color: 'yellow',
    rects: [
      { left: 0.08, top: 0.44, width: 0.84, height: 0.024 }
    ]
  });
  await db.saveHighlight(hl1);

  const note1 = createSideNote({
    fileId: file1.id,
    highlightId: hl1.id,
    pageNumber: 1,
    content: '⭐ Important benchmark metric: Sub-second latency and <0.05% FPR is the baseline target for our own thesis Chapter 4 experiments!'
  });
  await db.saveSideNote(note1);

  await db.saveScratchpad(file1.id, `# RansomShield Summary Notes

## Key Takeaways
- Uses **eBPF (extended Berkeley Packet Filter)** in Linux kernel to monitor file system I/O IOPS and entropy.
- GNN model achieves sub-2s response time.

## Quotes for Thesis Chapter 2
> "By decoupling ingestion from inference, our pipeline achieves high throughput scaling beyond 100,000 events per second."

## Comparison with our work
- RansomShield relies on server kernel hooks; our thesis extends this to distributed microservices.`);

  // Paper 2: ZeroTrust Cloud
  const p2Buffer = createAcademicPDF(
    'ZeroTrust-Cloud: Continuous Authentication Architecture',
    'Michael Chang, Laura Vance, David Gomez',
    'Perimeter defenses are obsolete in hybrid cloud infrastructures. This paper presents a continuous contextual authentication engine based on Bayesian risk scoring and dynamic micro-segmentation.'
  );

  const file2 = createPaperFile({
    name: 'Chang2023_ZeroTrust_Cloud_Architecture.pdf',
    folderId: fSubtopic2.id,
    size: p2Buffer.byteLength,
    tags: ['ZeroTrust', 'CloudSecurity', 'AccessControl'],
    pdfData: p2Buffer,
    pageCount: 3
  });
  await db.saveFile(file2);

  const meta2 = createPaperMetadata({
    fileId: file2.id,
    title: 'ZeroTrust-Cloud: Continuous Contextual Authentication and Micro-segmentation for Hybrid Clouds',
    authors: 'Michael Chang, Laura Vance, and David Gomez',
    year: '2023',
    journal: 'ACM Conference on Computer and Communications Security (CCS)',
    volume: '30',
    issue: '4',
    pages: '345-360',
    doi: '10.1145/3576915.3623120',
    publisher: 'ACM',
    abstract: 'An automated Zero Trust architecture calculating dynamic risk scores based on user telemetry, device hygiene, and network provenance.',
    contributions: 'Continuous dynamic risk calculation without disrupting valid user sessions.',
    limitations: 'High initial calibration period needed (approx 14 days of historical logs).',
    methodology: 'Bayesian risk models + Software-Defined Networking (SDN) micro-segmentation.',
    findings: 'Reduced credential compromise lateral blast radius by 88% across enterprise trials.'
  });
  await db.saveMetadata(meta2);

  // Paper 3: Transformer Log Anomaly
  const p3Buffer = createAcademicPDF(
    'TransLog: Deep Transformer Anomaly Detection for Large-Scale Logs',
    'Elena Petrova, Marcus Weber',
    'Log analysis is crucial for modern enterprise observability. We propose TransLog, an attention-based Transformer model tailored for parsing unstructured system logs with zero manual rule maintenance.'
  );

  const file3 = createPaperFile({
    name: 'Petrova2024_TransLog_Anomaly_Detection.pdf',
    folderId: fSubtopic3.id,
    size: p3Buffer.byteLength,
    tags: ['DeepLearning', 'NLP', 'LogAnalysis', 'CloudSecurity'],
    pdfData: p3Buffer,
    pageCount: 3
  });
  await db.saveFile(file3);

  const meta3 = createPaperMetadata({
    fileId: file3.id,
    title: 'TransLog: Self-Supervised Transformer Architecture for Unstructured System Log Anomaly Detection',
    authors: 'Elena Petrova and Marcus Weber',
    year: '2024',
    journal: 'USENIX Security Symposium',
    volume: '33',
    issue: '1',
    pages: '789-804',
    doi: '10.5555/usenix.sec24.089',
    publisher: 'USENIX Association',
    abstract: 'Self-supervised bidirectional Transformer model capable of handling unseen log templates with 98.7% F1-score on BGL and Thunderbird datasets.',
    contributions: 'Zero-shot template parsing and attention-weighted anomaly localization.',
    limitations: 'Inference latency is 45ms per log batch, requiring GPU acceleration for massive loads.',
    methodology: 'Pre-trained BERT-style masking on 200GB open log corpus.',
    findings: 'Achieved 98.7% F1-score, surpassing DeepLog and LogRobust.'
  });
  await db.saveMetadata(meta3);

  console.log('Sample thesis papers loaded successfully.');
}
