const Anthropic = require("@anthropic-ai/sdk"); 
const nodemailer = require("nodemailer");
const fs = require("fs");

const client = new Anthropic.Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// âââ Your Target Companies ââââââââââââââââââââââââââââââââââââââââââââââââââââ

const DREAM_COMPANIES = [
  "New York Magazine",
  "The Atlantic",
  "New Yorker",
  "Assouline",
  "Phaidon",
  "Rizzoli",
  "Apartamento",
  "Monocle",
  "MIT Press",
  "Princeton Architectural Press",
  "Berggruen Institute",
  "Getty",
  "MoMA",
  "Whitney Museum",
  "Guggenheim",
  "Cooper Hewitt",
  "Smithsonian",
  "MacArthur Foundation",
  "Mellon Foundation",
  "Aesop",
  "Ace Hotel",
  "Soho House",
  "Kinfolk",
  "Hem",
  "Pentagram",
  "2x4",
  "OMA",
  "Bloomberg Media",
  "Reuters",
  "Conde Nast"
];

const STABILITY_COMPANIES = [
  "Berkeley Research Group",
  "Keystone Strategy",
  "Ankura",
  "Huron Consulting",
  "FTI Consulting",
  "Alvarez and Marsal",
  "Charles River Associates",
  "Exponent",
  "Guidehouse",
  "Kroll",
  "Analysis Group",
  "Cornerstone Research",
  "NERA Economic Consulting",
  "Compass Lexecon",
  "Brattle Group",
  "Skadden Arps",
  "Kirkland Ellis",
  "Latham Watkins",
  "Paul Weiss",
  "Cravath Swaine",
  "Sullivan Cromwell",
  "Weil Gotshal",
  "Gibson Dunn",
  "Cleary Gottlieb",
  "Brookfield Asset Management",
  "Related Companies",
  "Tishman Speyer",
  "Vornado Realty",
  "Hines",
  "Silverstein Properties",
  "RXR Realty",
  "Blackstone",
  "KKR",
  "Apollo Global",
  "Carlyle Group",
  "Warburg Pincus",
  "General Atlantic",
  "Gates Foundation",
  "Ford Foundation",
  "Rockefeller Foundation",
  "Bloomberg Philanthropies",
  "Grant Thornton",
  "BDO",
  "RSM",
  "Forvis Mazars",
  "Marsh McLennan",
  "Aon",
  "Willis Towers Watson",
  "NYU",
  "Columbia University",
  "University of Pennsylvania",
  "Duke University",
  "Emory University",
  "Vanderbilt University",
  "Mayo Clinic",
  "Cleveland Clinic",
  "Memorial Sloan Kettering",
  "Mass General Brigham",
  "Kaiser Permanente"
];

// âââ Search Prompts âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

const DREAM_PROMPT = `You are a job search agent working on behalf of a senior creative professional.

Search the web RIGHT NOW for newly posted job listings (posted within the last 24-48 hours only) at these specific companies: ${DREAM_COMPANIES.join(", ")}.

Look for these roles: Creative Director, Design Director, VP of Creative, Executive Creative Director, Head of Creative, Chief Creative Officer.

The candidate profile:
- 30+ years experience, doing the best work of their career
- Deep expertise in brand identity, editorial, campaigns, cultural institutions
- Based in NYC, open to hybrid or relocation for exceptional roles
- Salary expectation: $230,000-$300,000+
- Avoid: product design, UX/UI, junior roles, generic marketing

For each matching role found, return:
- Company name
- Job title
- Location
- Salary (if listed)
- Date posted
- A 3-sentence summary of why this is a strong match
- Direct URL to the job listing

Only return roles posted in the last 48 hours. If nothing new, say "NO_NEW_ROLES".
Format as JSON array.`;

const STABILITY_PROMPT = `You are a job search agent working on behalf of a senior creative professional.

Search the web RIGHT NOW for newly posted job listings (posted within the last 24-48 hours only) at these specific companies: ${STABILITY_COMPANIES.join(", ")}.

Also search broadly for: Creative Director OR Design Director OR "Creative Services Director" at law firms, economic consulting firms, private equity firms, foundations, and major universities. Remote positions strongly preferred.

The candidate profile:
- 30+ years experience in brand, editorial, campaigns, creative operations
- Looking for stable remote-friendly in-house creative leadership
- Salary expectation: $150,000+
- Avoid: product design, UX/UI, early-stage startups, generic marketing strategy

For each matching role found, return:
- Company name
- Job title  
- Location / remote status
- Salary (if listed)
- Date posted
- A 3-sentence summary of why this is a strong match
- Direct URL to the job listing

Only return roles posted in the last 48 hours. If nothing new, say "NO_NEW_ROLES".
Format as JSON array.`;

// âââ Run Agent Search âââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

async function runSearch(prompt, label) {
  console.log(`Running ${label} search...`);
  try {
    const response = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 4000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: prompt }]
    });

    const textBlocks = response.content.filter(b => b.type === "text").map(b => b.text);
    const fullText = textBlocks.join("\n");

    if (fullText.includes("NO_NEW_ROLES")) {
      console.log(`${label}: No new roles found.`);
      return [];
    }

    const jsonMatch = fullText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error(`${label} search failed:`, err.message);
    return [];
  }
}

// âââ Deduplication ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

const SEEN_FILE = "seen_jobs.json";

function loadSeen() {
  try { return JSON.parse(fs.readFileSync(SEEN_FILE, "utf8")); }
  catch { return []; }
}

function saveSeen(seen) {
  fs.writeFileSync(SEEN_FILE, JSON.stringify(seen, null, 2));
}

function filterNew(jobs, seen) {
  return jobs.filter(job => {
    const id = `${job.company}-${job.title}`.toLowerCase().replace(/\s+/g, "-");
    if (seen.includes(id)) return false;
    seen.push(id);
    return true;
  });
}

// âââ Email ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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
            ${job.location} ${job.salary ? `Â· ${job.salary}` : ""} Â· Posted: ${job.posted || "recently"}
          </div>
          <div style="font-size:14px;color:#333;line-height:1.6;margin-bottom:12px">${job.summary || ""}</div>
          <a href="${job.url}" style="background:#2d5a8e;color:white;padding:8px 18px;border-radius:5px;text-decoration:none;font-size:13px;font-weight:600">View Role â</a>
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
      ${formatJobs(dreamJobs, "ð¯ Dream Roles")}
      ${formatJobs(stabilityJobs, "ð§­ Stability Roles")}
      <hr style="border:none;border-top:1px solid #eee;margin:32px 0">
      <p style="font-size:11px;color:#bbb;text-align:center">Job Agent Â· Running hourly via GitHub Actions</p>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to: process.env.NOTIFY_EMAIL,
    subject: `Job Agent: ${totalNew} new role${totalNew > 1 ? "s" : ""} found`,
    html
  });

  console.log(`Email sent with ${totalNew} new roles.`);
}

// âââ Main âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

async function main() {
  const seen = loadSeen();

  const [dreamResults, stabilityResults] = await Promise.all([
    runSearch(DREAM_PROMPT, "Dream Roles"),
    runSearch(STABILITY_PROMPT, "Stability Roles")
  ]);

  const newDream = filterNew(dreamResults, seen);
  const newStability = filterNew(stabilityResults, seen);

  saveSeen(seen);

  if (newDream.length || newStability.length) {
    await sendEmail(newDream, newStability);
  } else {
    console.log("No new roles found this run.");
  }
}

main().catch(console.error);
