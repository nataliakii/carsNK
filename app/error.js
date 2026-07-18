"use client";
import Image from "next/image";
import React from "react";

function error() {
  return (
    <div className="loading-container vibrate-1">
      <h3 style={{ marginBottom: 20 }}>Ooops! error...</h3>{" "}
      <Image
        src="/favicon.png"
        alt="bb qr code ki"
        width={130}
        height={130}
        unoptimized
      />
    </div>
  );
}

export default error;
