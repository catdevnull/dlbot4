import { getDescription } from "./metadata";
import { expect, test } from "bun:test";

test("tiktok", async () => {
	const result = await getDescription(
		"https://www.tiktok.com/@elpelucamilei/video/7457672168084688133",
	);
	expect(result.description).toInclude("SOY UN ADICTO AL TRABAJO");
});
test("instagram post", async () => {
	const result = await getDescription(
		"https://www.instagram.com/p/DG6ITWET2X-/",
	);
	expect(result.description).toInclude(
		"Houthis will resume naval operations against #Israel if Israel does not lift its blockage of aid into #Gaza within four days",
	);
});

// en opengraph, tiene esto: "In this enlightening discussion, Alan Dershowitz, a renowned expert in international law, delves into the complexities of statehood and its relationship to international law. He argues that a state must earn its status through hard work, dedication, and adherence to the principles of democracy and human rights. This concept is highly relevant to the Palestinian people who have been seeking statehood for decades. The implications of Dershowitz's argument are profound, with far-reaching consequences for international relations and global governance. By examining the intricacies of statehood, Dershowitz sheds light on the importance of stability, security, and cooperation in international relations."
test("instagram post with ai generated opengraph description", async () => {
	const result = await getDescription(
		"https://www.instagram.com/p/DS5lyFlktmX/",
	);
	expect(result.description).toEqual("No caption");
	expect(result.aiDescription).toInclude("In this enlightening discussion");
});

test("instagram reel", async () => {
	const result = await getDescription(
		"https://www.instagram.com/reel/DG29EO3tszb/",
	);
	expect(result.description).toInclude(
		"Palestinians traveling abroad can be stuck in Jordan for days because Israel refuses to let them re-enter Palestine",
	);
});
