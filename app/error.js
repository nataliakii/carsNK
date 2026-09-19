"use client";
import Image from "next/image";
import React from "react";
import { getActiveBrand } from "@config/brand";

function error() {
  const mark = getActiveBrand().logos.mark;
  return (
    <div className="loading-container vibrate-1">
      <h3 style={{ marginBottom: 20 }}>Ooops! error...</h3>
      <Image src={mark} alt="" width={130} height={130} unoptimized />
    </div>
  );
}

export default error;
