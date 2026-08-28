import { finalizeBuildingProfile } from "./buildingProfile.js";

export function demoGeorgeProfile(nowYear = 2026) {
  const profile = finalizeBuildingProfile({
    nowYear,
    model: "seed",
    sourcesText: [
      "https://www.equityapartments.com/san-francisco/soma/the-george-apartments",
      "The George apartments in SoMa, San Francisco. Built in 2021.",
      "Fitness center, rooftop terrace, resident lounge, package receiving, and coworking space.",
      "Walkable SoMa streets with restaurants, coffee, and transit nearby.",
    ].join("\n"),
    raw: {
      facts: {
        yearBuilt: 2021,
        yearBuiltEvidence: "Equity lists The George as built in 2021.",
        walkScore: null,
        stories: null,
        neighborhood: "SoMa, San Francisco",
        amenities: ["gym", "rooftop", "lounge", "packageRoom", "coworking"],
      },
      judgments: {
        safety: {
          score: 8.7,
          rationale: "Controlled-access mid-rise in SoMa; not a claim about a specific unit.",
          evidence: "Building marketing and neighborhood context for SoMa.",
        },
        walkability: {
          score: 9.5,
          rationale: "SoMa is walkable to restaurants, coffee, grocery, and transit.",
          evidence: "Location recorded as SoMa, San Francisco on the official page.",
        },
        viewsSun: {
          score: 8.1,
          rationale: "Newer mid-rise with rooftop; unit views still vary by floor and exposure.",
          evidence: "Official page highlights a rooftop terrace. This is a building-level estimate.",
        },
        amenities: {
          score: 9.0,
          rationale: "Gym, rooftop, lounge, package room, and coworking are listed for the building.",
          evidence: "Fitness center, rooftop terrace, resident lounge, package receiving, coworking space.",
        },
      },
      summary:
        "The George is a 2021 SoMa building with strong walkability for new grads and a solid amenity set (gym, rooftop, lounge, package room, coworking). Building-level views/sun are generally good; a specific unit may still be dark or face a neighboring wall.",
    },
  });
  profile.analyzedAt = new Date().toISOString();
  profile.status = "complete";
  return profile;
}

export function demoAvalonProfile(nowYear = 2026) {
  const profile = finalizeBuildingProfile({
    nowYear,
    model: "seed",
    sourcesText: [
      "https://www.avaloncommunities.com/california/san-francisco-apartments/avalon-dogpatch/",
      "Avalon Dogpatch in San Francisco. The community opened in 2018.",
      "Fitness center, pool, parking, package services, lounge, and outdoor spaces.",
    ].join("\n"),
    raw: {
      facts: {
        yearBuilt: 2018,
        yearBuiltEvidence: "Avalon materials list a 2018 opening year.",
        walkScore: null,
        stories: null,
        neighborhood: "Dogpatch, San Francisco",
        amenities: ["gym", "pool", "parking", "packageRoom", "lounge", "outdoor"],
      },
      judgments: {
        safety: {
          score: 7.8,
          rationale: "Gated residential campus in Dogpatch; surroundings are mixed industrial-residential.",
          evidence: "Location recorded as Dogpatch, San Francisco.",
        },
        walkability: {
          score: 8.4,
          rationale: "Walkable to Dogpatch restaurants and parks; a bit farther from downtown job hubs than SoMa.",
          evidence: "Official page and stored Dogpatch location.",
        },
        viewsSun: {
          score: 7.2,
          rationale: "Lower-rise courtyards and a pool deck; many units look inward. Building-level only.",
          evidence: "Community photos emphasize courtyards and a pool, not a high tower.",
        },
        amenities: {
          score: 8.6,
          rationale: "Gym, pool, parking, lounge, package room, and outdoor space.",
          evidence: "Fitness center, pool, parking, package services, lounge, outdoor spaces.",
        },
      },
      summary:
        "Avalon Dogpatch (2018) is a full-amenity community with a pool and parking. Walkability is strong for the neighborhood. Views/sun vary widely by courtyard vs street exposure — this score is for the building, not a unit.",
    },
  });
  profile.analyzedAt = new Date().toISOString();
  profile.status = "complete";
  return profile;
}
