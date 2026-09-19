import React from "react";
import Link from "next/link";
import Image from "next/image";
import { getActiveBrand } from "@config/brand";

function notfound() {
  const mark = getActiveBrand().logos.mark;
  return (
    <div className="loading-container">
      <h3 style={{ marginBottom: 20 }}>oops! sorry, this page wasnot found </h3>
      <Image src={mark} alt="" width={200} height={200} unoptimized />
      <Link style={{ marginTop: 40 }} href="/">
        Come back home
      </Link>
    </div>
  );
}

export default notfound;
