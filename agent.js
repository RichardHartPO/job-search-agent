const Anthropic = require("@anthropic-ai/sdk");
const nodemailer = require("nodemailer");
const fs = require("fs");

const client = new Anthropic.Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// --- Target Companies ---

const DREAM_COMPANIES = [
  "New York Magazine", "The New Yorker", "Frieze", "Apartamento", "Cereal",
  "Garage Magazine", "AnOther Magazine", "Fantastic Man", "The Face", "The Surfer's Journal",
  "Stab Magazine", "Wax Poetics", "MOJO", "Uncut", "The Wire",
  "Resident Advisor", "Pitchfork", "Rolling Stone", "The Atlantic", "Assouline",
  "Phaidon", "Rizzoli", "MIT Press", "Princeton Architectural Press", "WePresent",
  "Thames and Hudson", "Paris Review", "MoMA", "Whitney Museum", "Guggenheim",
  "Cooper Hewitt", "Getty", "Berggruen Institute", "Hammer Museum", "Walker Art Center",
  "Brooklyn Museum", "New Museum", "MASS MoCA", "Dia Art Foundation", "ICA",
  "Perez Art Museum", "Crystal Bridges", "The Met", "Art Institute of Chicago", "LACMA",
  "Philadelphia Museum of Art", "Cleveland Museum of Art", "Isabella Stewart Gardner",
  "American Museum of Natural History", "Field Museum", "California Academy of Sciences",
  "Museum of Arts and Design", "National Building Museum", "Chicago Architecture Center",
  "Museum of the Moving Image", "Paley Center", "Academy Museum of Motion Pictures",
  "Exploratorium", "Gagosian", "Hauser and Wirth", "David Zwirner", "Pace Gallery",
  "Studio Olafur Eliasson", "Alicja Kwade Studio", "Taryn Simon Studio",
  "Wolfgang Tillmans Studio", "Lorna Simpson Studio", "Aesop", "Ace Hotel",
  "Soho House", "Hem", "MillerKnoll", "Knoll", "Vitra", "Steelcase",
  "OMA", "Pentagram", "2x4", "Skidmore Owings and Merrill", "Gensler",
  "Perkins and Will", "HOK", "TED", "Sundance Institute", "Tribeca",
  "PEN America", "National Book Foundation", "American Academy of Arts and Sciences",
  "Aspen Institute", "Long Now Foundation", "Dark Matter Labs", "Forensic Architecture",
  "Anthropic", "OpenAI", "Apple", "Google", "Amazon", "Bloomberg Media", "Reuters"
];

const STABILITY_COMPANIES = [
  "Berkeley Research Group", "Keystone Strategy", "Ankura", "Huron Consulting",
  "FTI Consulting", "Alvarez and Marsal", "Charles River Associates", "Exponent",
  "Guidehouse", "Kroll", "Analysis Group", "Cornerstone Research",
  "NERA Economic Consulting", "Compass Lexecon", "Brattle Group", "AlixPartners",
  "Econic", "McKinsey", "Bain", "Boston Consulting Group",
  "Skadden Arps", "Kirkland Ellis", "Latham Watkins", "Paul Weiss",
  "Cravath Swaine", "Sullivan Cromwell", "Weil Gotshal", "Gibson Dunn", "Cleary Gottlieb",
  "Brookfield Asset Management", "Related Companies", "Tishman Speyer",
  "Vornado Realty", "Hines", "Silverstein Properties", "RXR Realty", "Hudson Yards",
  "Grant Thornton", "BDO", "RSM", "Forvis Mazars",
  "Gates Foundation", "Ford Foundation", "Rockefeller Foundation", "Bloomberg Philanthropies",
  "MacArthur Foundation", "Mellon Foundation", "Knight Foundation", "Simons Foundation",
  "Chan Zuckerberg Initiative", "Luminate", "Open Society Foundations", "Carnegie Corporation",
  "Urban Institute", "New America", "Demos", "Century Foundation",
  "Council on Foreign Relations", "Brookings Institution", "92NY",
  "American Civil Liberties Union", "Natural Resources Defense Council",
  "Environmental Defense Fund", "Sierra Club", "Nature Conservancy", "World Wildlife Fund",
  "ProPublica", "The Marshall Project", "The Intercept", "Mother Jones", "The Nation",
  "NPR", "PBS", "WNYC", "American Public Media",
  "Thomson Reuters", "LexisNexis", "Wolters Kluwer", "S&P Global", "Morningstar", "MSCI",
  "Wiley", "Springer Nature", "The Economist Group", "Financial Times",
  "Smithsonian Institution", "New-York Historical Society", "Museum of the City of New York",
  "National Constitution Center", "Tenement Museum", "World Monuments Fund",
  "National Trust for Historic Preservation",
  "Four Seasons", "Rosewood", "Mandarin Oriental", "LVMH Corporate", "Richemont",
  "Planned Parenthood", "American Cancer Society", "American Heart Association",
  "Partners in Health", "Doctors Without Borders USA",
  "Mozilla Foundation", "Wikimedia Foundation", "Electronic Frontier Foundation",
  "Human Rights Watch", "Amnesty International", "Oxfam America",
  "Relativity", "Logikcull", "Everlaw",
  "Harvard University", "Yale University", "Columbia University", "Princeton University",
  "Dartmouth College", "Brown University", "Cornell University", "MIT", "Stanford University",
  "University of Chicago", "Northwestern University", "Johns Hopkins University",
  "Georgetown University", "NYU", "Tufts University", "Boston University",
  "Northeastern University", "RISD", "Parsons School of Design", "Pratt Institute",
  "CalArts", "MICA", "Cranbrook Academy of Art", "UCLA", "USC",
  "University of Michigan", "University of Virginia", "The New School",
  "Cooper Union", "School of Visual Arts", "Fordham University"
];

// --- Shared prompt sections ---

const SOURCE_RULES = `
SOURCE PRIORITY:
- STRONGLY PREFER results from the company's own careers page (e.g. moma.org/careers, newyorker.com/careers)
- STRONGLY PREFER ATS platforms where companies post directly: Greenhouse (boards.greenhouse.io), Lever (jobs.lever.co), Workday (myworkdayjobs.com), Ashby (jobs.ashbyhq.com), SmartRecruiters, BambooHR
- Use search queries like: "site:greenhouse.io [company] creative director" or "[company] careers creative director" or "[company] jobs creative director"

AGGREGATOR EXCLUSION — do NOT return results from these domains. If a role only appears on one of these sites, skip it:
linkedin.com, indeed.com, glassdoor.com, ziprecruiter.com, simplyhired.com, monster.com, careerbuilder.com, builtin.com, themuse.com, wellfound.com, theladders.com, flexjobs.com`;

const DATE_RULES = `
DATE HANDLING:
- Extract whatever date information is available: absolute dates, relative dates like "2 weeks ago", or "recently posted"
- Convert relative dates to YYYY-MM-DD using today's date as reference
- If no date information is available at all, set "posted" to "unknown" and still include the role
- Prioritize thoroughness over precision: better to include a role with an uncertain date than to miss a real one
- Include roles posted within the last 14 days`;

const JSON_FORMAT = `
Return a JSON array. Each object must use exactly these field names:
{ "company": "...", "title": "...", "location": "...", "salary": "...", "posted": "YYYY-MM-DD or unknown", "summary": "...", "url": "..." }

The "summary" field should be 2-3 sentences explaining why this is a strong match for the candidate.
If no matching roles are found, respond with exactly: NO_NEW_ROLES
Return only the JSON array or NO_NEW_ROLES — nothing else.`;

// --- Prompt builders ---

function buildDreamBatchPrompt(companies) {
  return `You are a job search agent working on behalf of a senior creative professional.

Search the web RIGHT NOW for job listings posted in the last 14 days at these specific companies: ${companies.join(", ")}.

Look for these roles: Creative Director, Design Director, VP Creative, Executive Creative Director, Head of Creative, Art Director (senior), Head of Design.

Industries of focus: editorial publishing, cultural institutions, museums, galleries, artist studios, design-led brands, architecture firms, cultural organizations.

The candidate profile:
- 30+ years experience, doing the best work of their career
- Deep editorial sensibility, cultural credibility, expertise in craft and visual intelligence
- New York preferred, open to remote or relocation for exceptional roles
- Salary: $230,000 minimum, $300,000 target
- Prioritize: organizations where craft, aesthetics, and visual intelligence are core values
- Avoid: advertising agencies, marketing-led roles, e-commerce, UX/UI, product design, junior roles, anything where design is not central to the organization's identity
${SOURCE_RULES}
${DATE_RULES}
${JSON_FORMAT}`;
}

function buildStabilityBatchPrompt(companies) {
  return `You are a job search agent working on behalf of a senior creative professional.

Search the web RIGHT NOW for job listings posted in the last 14 days at these specific companies: ${companies.join(", ")}.

Look for these roles: Creative Director, Design Director, Creative Services Director, Head of Creative, Director of Brand.

The candidate profile:
- 30+ years experience in brand, editorial, visual communications, creative operations
- Looking for stable, remote-friendly in-house creative leadership with real autonomy
- Location: remote strongly preferred, anywhere in the United States
- Salary: $150,000 minimum
- Prioritize: stable organizations that lack a strong in-house creative function and would value someone who could build one — places with strong values, mission-driven culture, or intellectual seriousness
- Avoid: advertising agencies, marketing strategy roles, e-commerce, UX/UI, product design, early-stage startups, anything requiring deep marketing expertise
${SOURCE_RULES}
${DATE_RULES}
${JSON_FORMAT}`;
}

function buildDreamSweepPrompt() {
  return `You are a job search agent working on behalf of a senior creative professional.

Search the web RIGHT NOW for Creative Director, Design Director, VP Creative, Executive Creative Director, Head of Creative, Art Director (senior), or Head of Design roles posted in the last 14 days. Do NOT search for specific named companies — this is a broad category sweep to find roles that specific-company searches may have missed.

Search across organizations in these industries:
- Editorial and cultural publishing (magazines, art books, literary journals)
- Art museums, natural history museums, science museums, design museums
- Galleries (commercial and nonprofit)
- Artist studios and cultural foundations
- Design-led consumer brands and hospitality companies
- Architecture and design firms
- Cultural organizations, film festivals, literary organizations, civic cultural institutions

The candidate profile:
- 30+ years experience, doing the best work of their career
- Deep editorial sensibility, cultural credibility, expertise in craft and visual intelligence
- New York preferred, open to remote or relocation for exceptional roles
- Salary: $230,000 minimum, $300,000 target
- Prioritize: organizations where craft, aesthetics, and visual intelligence are core values
- Avoid: advertising agencies, marketing-led roles, e-commerce, UX/UI, product design, junior roles
${SOURCE_RULES}
${DATE_RULES}
${JSON_FORMAT}`;
}

function buildStabilitySweepPrompt() {
  return `You are a job search agent working on behalf of a senior creative professional.

Search the web RIGHT NOW for Creative Director, Design Director, Creative Services Director, Head of Creative, or Director of Brand roles posted in the last 14 days. Do NOT search for specific named companies — this is a broad category sweep to find roles that specific-company searches may have missed.

Search across organizations in these industries:
- Economic consulting and management consulting firms
- Big Law firms
- Real estate development and investment companies
- Accounting and professional services firms
- Foundations and philanthropies
- Think tanks and civic organizations
- Journalism nonprofits and public media organizations
- Professional and academic publishers
- Luxury hospitality companies
- Healthcare nonprofits and advocacy organizations
- Internet freedom, digital rights, and international NGOs
- Legal technology companies

Remote positions strongly preferred.

The candidate profile:
- 30+ years experience in brand, editorial, visual communications, creative operations
- Looking for stable, remote-friendly in-house creative leadership with real autonomy
- Location: remote strongly preferred, anywhere in the United States
- Salary: $150,000 minimum
- Prioritize: stable organizations that lack a strong in-house creative function and would value someone who could build one
- Avoid: advertising agencies, marketing strategy roles, e-commerce, UX/UI, product design, early-stage startups
${SOURCE_RULES}
${DATE_RULES}
${JSON_FORMAT}`;
}

// --- Utility ---

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// --- Search ---

async function runSearch(prompt, label) {
  console.log(`\n[SEARCH] ${label}`);
  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: prompt }]
    });

    const textBlocks = response.content.filter(b => b.type === "text").map(b => b.text);
    const fullText = textBlocks.join("\n");

    if (fullText.includes("NO_NEW_ROLES")) {
      console.log(`[RESULT] ${label}: no roles found`);
      return [];
    }

    const jsonMatch = fullText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.log(`[RESULT] ${label}: no JSON in response`);
      return [];
    }

    const jobs = JSON.parse(jsonMatch[0]);
    console.log(`[RESULT] ${label}: ${jobs.length} raw result(s)`);
    return jobs;
  } catch (err) {
    console.error(`[ERROR] ${label} failed:`, err.message);
    return [];
  }
}

// --- Filters ---

const AGGREGATOR_DOMAINS = [
  "linkedin.com", "indeed.com", "glassdoor.com", "ziprecruiter.com",
  "simplyhired.com", "monster.com", "careerbuilder.com", "builtin.com",
  "themuse.com", "wellfound.com", "theladders.com", "flexjobs.com"
];

function filterAggregators(jobs, label) {
  return jobs.filter(job => {
    if (!job.url) return true;
    const domain = AGGREGATOR_DOMAINS.find(d => job.url.includes(d));
    if (domain) {
      console.log(`[REJECT] ${label}: "${job.title}" at ${job.company} — aggregator URL (${domain})`);
      return false;
    }
    return true;
  });
}

function filterByDate(jobs, label) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
  cutoff.setHours(0, 0, 0, 0);

  return jobs.filter(job => {
    if (!job.posted || job.posted === "unknown" || !/^\d{4}-\d{2}-\d{2}$/.test(job.posted)) {
      console.log(`[INCLUDE] ${label}: "${job.title}" at ${job.company} — date unverified, flagging`);
      job.dateUnverified = true;
      return true;
    }
    const posted = new Date(job.posted + "T00:00:00");
    if (posted < cutoff) {
      console.log(`[REJECT] ${label}: "${job.title}" at ${job.company} — posted ${job.posted}, older than 14 days`);
      return false;
    }
    return true;
  });
}

// --- Deduplication ---

const SEEN_FILE = "seen_jobs.json";

function loadSeen() {
  try { return JSON.parse(fs.readFileSync(SEEN_FILE, "utf8")); }
  catch { return []; }
}

function saveSeen(seen) {
  fs.writeFileSync(SEEN_FILE, JSON.stringify(seen, null, 2));
}

function filterNew(jobs, seen, label) {
  return jobs.filter(job => {
    const id = `${job.company}-${job.title}`.toLowerCase().replace(/\s+/g, "-");
    if (seen.includes(id)) {
      console.log(`[DEDUP] ${label}: skipping "${job.title}" at ${job.company} — already seen`);
      return false;
    }
    seen.push(id);
    return true;
  });
}

// --- Email ---

async function sendEmail(dreamJobs, stabilityJobs) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });

  const formatJobs = (jobs, label) => {
    if (!jobs.length) return `<h2>${label}</h2><p>No new roles in the last run.</p>`;
    return `
      <h2 style="color:#1a1a2e;border-bottom:2px solid #eee;padding-bottom:8px">${label}</h2>
      ${jobs.map(job => `
        <div style="margin-bottom:28px;padding:20px;background:#f9f9f9;border-radius:8px;border-left:4px solid #2d5a8e">
          <div style="font-size:18px;font-weight:700;color:#1a1a2e">${job.title}</div>
          <div style="font-size:15px;color:#2d5a8e;margin:4px 0">${job.company}</div>
          <div style="font-size:13px;color:#666;margin-bottom:10px">
            ${job.location}${job.salary ? ` &middot; ${job.salary}` : ""}
          </div>
          <div style="font-size:12px;font-weight:600;margin-bottom:10px;padding:4px 8px;border-radius:4px;display:inline-block;${job.dateUnverified ? "color:#8a6000;background:#fff8e1" : "color:#2d5a8e;background:#e8f0f8"}">
            ${job.dateUnverified ? "Date unverified" : `Posted: ${job.posted}`}
          </div>
          <div style="font-size:14px;color:#333;line-height:1.6;margin-bottom:12px">${job.summary || ""}</div>
          <a href="${job.url}" style="background:#2d5a8e;color:white;padding:8px 18px;border-radius:5px;text-decoration:none;font-size:13px;font-weight:600">View Role &rarr;</a>
        </div>
      `).join("")}
    `;
  };

  const totalNew = dreamJobs.length + stabilityJobs.length;
  if (totalNew === 0) {
    console.log("No new jobs to email.");
    return;
  }

  const html = `
    <div style="font-family:Georgia,serif;max-width:680px;margin:0 auto;padding:32px 24px;color:#1a1a2e">
      <div style="font-size:13px;color:#999;text-align:right;margin-bottom:24px">${new Date().toLocaleString()}</div>
      <h1 style="font-size:26px;margin-bottom:4px">Job Agent Alert</h1>
      <p style="color:#666;margin-top:0">${totalNew} new role${totalNew > 1 ? "s" : ""} found matching your criteria</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
      ${formatJobs(dreamJobs, "Dream Roles")}
      ${formatJobs(stabilityJobs, "Stability Roles")}
      <hr style="border:none;border-top:1px solid #eee;margin:32px 0">
      <p style="font-size:11px;color:#bbb;text-align:center">Job Agent &middot; Running twice daily via GitHub Actions</p>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to: process.env.NOTIFY_EMAIL,
    subject: `Job Agent: ${totalNew} new role${totalNew > 1 ? "s" : ""} found`,
    html
  });

  console.log(`\n[EMAIL] Sent with ${totalNew} new roles.`);
}

// --- Main ---

async function main() {
  console.log("\n=== Job Search Agent Starting ===");
  const seen = loadSeen();

  const dreamBatches = chunkArray(DREAM_COMPANIES, 15);
  const stabilityBatches = chunkArray(STABILITY_COMPANIES, 15);

  console.log(`\n[PLAN] Dream: ${dreamBatches.length} batches + 1 sweep`);
  console.log(`[PLAN] Stability: ${stabilityBatches.length} batches + 1 sweep`);
  dreamBatches.forEach((b, i) =>
    console.log(`  Dream Batch ${i + 1}: ${b.join(", ")}`)
  );
  stabilityBatches.forEach((b, i) =>
    console.log(`  Stability Batch ${i + 1}: ${b.join(", ")}`)
  );

  // Run all searches in parallel
  const allSearchPromises = [
    runSearch(buildDreamSweepPrompt(), "Dream Sweep (broad category)"),
    runSearch(buildStabilitySweepPrompt(), "Stability Sweep (broad category)"),
    ...dreamBatches.map((batch, i) =>
      runSearch(buildDreamBatchPrompt(batch), `Dream Batch ${i + 1}/${dreamBatches.length} [${batch[0]} ... ${batch[batch.length - 1]}]`)
    ),
    ...stabilityBatches.map((batch, i) =>
      runSearch(buildStabilityBatchPrompt(batch), `Stability Batch ${i + 1}/${stabilityBatches.length} [${batch[0]} ... ${batch[batch.length - 1]}]`)
    )
  ];

  const allResults = await Promise.all(allSearchPromises);

  const dreamSweepResults = allResults[0];
  const stabilitySweepResults = allResults[1];
  const dreamBatchResults = allResults.slice(2, 2 + dreamBatches.length).flat();
  const stabilityBatchResults = allResults.slice(2 + dreamBatches.length).flat();

  const allDreamRaw = [...dreamBatchResults, ...dreamSweepResults];
  const allStabilityRaw = [...stabilityBatchResults, ...stabilitySweepResults];

  console.log(`\n[SUMMARY] Raw — Dream: ${allDreamRaw.length}, Stability: ${allStabilityRaw.length}`);

  const dreamAfterAgg = filterAggregators(allDreamRaw, "Dream");
  const stabilityAfterAgg = filterAggregators(allStabilityRaw, "Stability");
  console.log(`[SUMMARY] After aggregator filter — Dream: ${dreamAfterAgg.length}, Stability: ${stabilityAfterAgg.length}`);

  const dreamAfterDate = filterByDate(dreamAfterAgg, "Dream");
  const stabilityAfterDate = filterByDate(stabilityAfterAgg, "Stability");
  console.log(`[SUMMARY] After date filter — Dream: ${dreamAfterDate.length}, Stability: ${stabilityAfterDate.length}`);

  const newDream = filterNew(dreamAfterDate, seen, "Dream");
  const newStability = filterNew(stabilityAfterDate, seen, "Stability");
  console.log(`[SUMMARY] After dedup — Dream: ${newDream.length}, Stability: ${newStability.length}`);

  saveSeen(seen);

  console.log(`\n[FINAL] ${newDream.length} dream + ${newStability.length} stability roles to send`);

  if (newDream.length || newStability.length) {
    await sendEmail(newDream, newStability);
  } else {
    console.log("[DONE] No new roles this run.");
  }
}

main().catch(console.error);
