import { Big_Shoulders, IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_Condensed } from "next/font/google";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
});

const plexCond = IBM_Plex_Sans_Condensed({
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700"],
  variable: "--font-plex-cond",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
});

const bigShoulders = Big_Shoulders({
  subsets: ["latin", "latin-ext"],
  weight: ["800"],
  variable: "--font-big-shoulders",
});

export const landingFontVars = `${plexSans.variable} ${plexCond.variable} ${plexMono.variable} ${bigShoulders.variable}`;
