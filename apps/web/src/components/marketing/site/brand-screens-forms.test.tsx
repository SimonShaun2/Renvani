import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/app/(marketing)/demo/actions", () => ({ submitDemoRequest: vi.fn() }));
vi.mock("@/app/(marketing)/growth-check/actions", () => ({ submitGrowthCheck: vi.fn() }));
vi.mock("./fonts", () => ({ geist: { variable: "g" }, inter: { variable: "i", className: "inter" }, newsreader: { variable: "n" } }));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
import { DemoPage } from "./DemoPage";
import { GrowthCheckPage } from "./GrowthCheckPage";
import { IndustryProductScreen, INDUSTRY_PRODUCT_SCREENS } from "./IndustryProductScreen";
import { INDUSTRY_JOURNEYS } from "./industry-journeys";
import { runIntake } from "@/src/lib/marketing-intake";
import { MarketingShell } from "./MarketingShell";
afterEach(cleanup);
const labels = ["First Name", "Last Name", "Work Email", "Contact Number", "Business Name", "Trade", "Team Size"];
const publicRoot = join(__dirname, "../../../../public");
const contact = { firstName: "Alex", lastName: "Rivera", email: "ALEX@EXAMPLE.COM", phone: "(918) 555-0100", company: "Rivera Heating", trade: "hvac", teamSize: "2–5", hp: "" };
function form(extra: Record<string, string> = {}) { const f = new FormData(); for (const [k,v] of Object.entries({...contact,...extra})) f.set(k,v); return f; }

describe("requested brand, real product screenshots and seven-field forms", () => {
  it.each(["demo", "growth"])("%s has the seven required core fields in order", kind => {
    const {container}=render(kind === "demo" ? <DemoPage action={vi.fn()} /> : <GrowthCheckPage action={vi.fn()} />);
    expect([...container.querySelectorAll('[data-lead-contact-fields] label')].map(n=>n.textContent)).toEqual(labels);
    for(const label of labels) expect(screen.getByLabelText(label).hasAttribute("required")).toBe(true);
    expect(screen.getByLabelText("Contact Number").getAttribute("type")).toBe("tel");
    expect(screen.getByLabelText("First Name").getAttribute("autocomplete")).toBe("given-name");
    expect(screen.getByLabelText("Last Name").getAttribute("autocomplete")).toBe("family-name");
  });
  it("keeps split names, normalized phone and team size in demo submissions", async () => {
    const send=vi.fn(async()=>new Response(JSON.stringify({ok:true,confirmationId:"demo-example"}),{status:201}));
    expect((await runIntake("demo-requests",form(),send as typeof fetch)).status).toBe("success");
    const payload=JSON.parse(String((send.mock.calls[0] as unknown as [string,RequestInit])[1].body));
    expect(payload).toMatchObject({name:"Alex Rivera",email:"alex@example.com",phone:"+19185550100",company:"Rivera Heating",trade:"hvac",message:"First name: Alex\nLast name: Rivera\nTeam size: 2–5"});
  });
  it("keeps all new contact fields alongside the Growth Check details", async () => {
    const send=vi.fn(async()=>new Response(JSON.stringify({ok:true,confirmationId:"growth-example"}),{status:201}));
    expect((await runIntake("growth-checks",form({websiteUrl:"example.com",location:"74103"}),send as typeof fetch)).status).toBe("success");
    const payload=JSON.parse(String((send.mock.calls[0] as unknown as [string,RequestInit])[1].body));
    expect(payload).toMatchObject({contact:{firstName:"Alex",lastName:"Rivera",phone:"+19185550100",company:"Rivera Heating",teamSize:"2–5"},email:"alex@example.com",trade:"hvac",zip:"74103",websiteUrl:"https://example.com"});
  });
  it.each(["demo-requests","growth-checks"] as const)("%s rejects missing contact and malformed phone before sending", async kind => {
    const send=vi.fn();const bad=await runIntake(kind,form({phone:"123",websiteUrl:"example.com",location:"74103"}),send);
    expect(bad).toMatchObject({status:"invalid",fields:{phone:expect.any(String)}});expect(send).not.toHaveBeenCalled();
    const blank=await runIntake(kind,form({firstName:"",lastName:"",phone:"",company:"",teamSize:"",websiteUrl:"example.com",location:"74103"}),send);
    expect(blank).toMatchObject({status:"invalid",fields:{firstName:expect.any(String),lastName:expect.any(String),phone:expect.any(String),company:expect.any(String),teamSize:expect.any(String)}});
  });
  it("every industry's third tool has a genuine local Figma screen asset and correct ratio",()=>{
    for(const journey of Object.values(INDUSTRY_JOURNEYS)){
      const spec=INDUSTRY_PRODUCT_SCREENS[journey.retain.tool]!;expect(spec).toBeTruthy();expect(spec.node).toMatch(/^\d+:\d+$/);
      const path=join(publicRoot,`marketing/product-screens/${journey.retain.tool}.avif`);expect(existsSync(path)).toBe(true);expect(readFileSync(path).length).toBeGreaterThan(1000);
      const {container,unmount}=render(<IndustryProductScreen tool={journey.retain.tool}/>);
      const img=container.querySelector("img")!;expect(Number(img.getAttribute("width"))).toBe(spec.width);expect(Number(img.getAttribute("height"))).toBe(spec.height);unmount();
    }
    expect(INDUSTRY_PRODUCT_SCREENS["technician-app"]).toMatchObject({width:1112,height:834,node:"643:87"});
  });
  it("uses the uploaded brand source rather than a text approximation",()=>{
    const {container}=render(<MarketingShell><div>Example page</div></MarketingShell>);
    expect(container.querySelectorAll('img[src="/brand/logo-horizontal.svg"]')).toHaveLength(2);
    const hash=(p:string)=>createHash("sha256").update(readFileSync(p)).digest("hex");
    expect(hash(join(publicRoot,"brand/logo-horizontal.svg"))).toBe("7884a7aaa994b9079e643239381fc8f7c59ccec02b9197aaae2a3ade4e737703");
    expect(hash(join(__dirname,"../../../../app/icon.svg"))).toBe("24b37e5d7401d520039cebf724e101f292b4d518ba2eef2ad2ebcce3382a8634");
    expect(hash(join(__dirname,"../../../../app/favicon.ico"))).toBe("c8443594a58924d5ec3a4a661ca6b40fb53369a7aaecd0e9cba3899a7997604a");
  });
});
