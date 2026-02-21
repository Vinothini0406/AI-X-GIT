"use client";

import { useUser } from "@clerk/nextjs";
import React from "react";

function DashBoardPage() {
  const { user } = useUser();

  return <div>{user?.firstName}</div>;
}

export default DashBoardPage;