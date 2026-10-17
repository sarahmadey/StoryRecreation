"use client";

import { useEffect, useState } from "react";

function forHour(h: number) {
  if (h < 5) return "The moon is up";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 20) return "Good evening";
  return "Almost bedtime";
}

export function Greeting({ name }: { name: string }) {
  const [hello, setHello] = useState("Welcome back");
  useEffect(() => setHello(forHour(new Date().getHours())), []);
  return (
    <>
      {hello}, {name}
    </>
  );
}
