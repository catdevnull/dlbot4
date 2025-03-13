import { getDescription } from "./metadata";
import { expect, test } from "bun:test";

test("tiktok", async () => {
  const description = await getDescription(
    "https://www.tiktok.com/@elpelucamilei/video/7457672168084688133"
  );
  expect(description).toInclude("SOY UN ADICTO AL TRABAJO");
});
test("instagram post", async () => {
  expect(
    await getDescription("https://www.instagram.com/p/DG6ITWET2X-/")
  ).toInclude(
    "Houthis will resume naval operations against #Israel if Israel does not lift its blockage of aid into #Gaza within four days"
  );
});
test("instagram reel", async () => {
  expect(
    await getDescription("https://www.instagram.com/reel/DG29EO3tszb/")
  ).toInclude(
    "Palestinians traveling abroad can be stuck in Jordan for days because Israel refuses to let them re-enter Palestine"
  );
});
