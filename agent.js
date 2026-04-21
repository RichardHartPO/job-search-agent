const Anthropic = require("@anthropic-ai/sdk"); 
const nodemailer = require("nodemailer");
const fs = require("fs");

const client = new Anthropic.Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// âââ Your Target Companies ââââââââââââââââââââââââââââââââââââââââââââââââââââ

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
  "Relativity", "Logikcull", "Everlaw"
];

// âââ Search Prompts âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

const DREAM_PROMPT = `You are a job search agent working on behalf of a senior creative professional.

Search the web RIGHT NOW for newly posted job listings (posted within the last 24-48 hours only) at these specific companies: ${DREAM_COMPANIES.join(", ")}.

Look for these roles: Creative Director, Design Director, VP Creative, Executive Creative Director, Head of Creative, Art Director (senior), Head of Design.

Industries of focus: editorial publishing, cultural institutions, museums, galleries, artist studios, design-led brands, architecture firms, cultural organizations.

The candidate profile:
- 30+ years experience, doing the best work of their career
- Deep editorial sensibility, cultural credibility, expertise in craft and visual intelligence
- New York preferred, open to remote or relocation for exceptional roles
- Salary: $230,000 minimum, $300,000 target
- Prioritize: organizations where craft, aesthetics, and visual intelligence are core values — places that would value a designer with deep editorial sensibility and cultural credibility
- Avoid: advertising agencies, marketing-led roles, e-commerce, UX/UI, product design, junior roles, anything where design is not central to the organization's identity

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

Also search broadly for: Creative Director OR Design Director OR "Creative Services Director" OR "Head of Creative" OR "Director of Brand" at economic consulting firms, management consulting firms, law firms, real estate firms, accounting firms, foundations, think tanks, civic organizations, journalism nonprofits, professional publishers, museums, luxury hospitality, healthcare nonprofits, internet freedom organizations, international NGOs, and legal technology companies. Remote positions strongly preferred.

The candidate profile:
- 30+ years experience in brand, editorial, visual communications, creative operations
- Looking for stable, remote-friendly in-house creative leadership with real autonomy
- Location: remote strongly preferred, anywhere in the United States
- Salary: $150,000 minimum
- Prioritize: stable organizations that lack a strong in-house creative function and would value someone who could build one — places with strong values, mission-driven culture, or intellectual seriousness where a senior creative could have real impact
- Avoid: advertising agencies, marketing strategy roles, e-commerce, UX/UI, product design, early-stage startups, anything requiring deep marketing expertise

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
