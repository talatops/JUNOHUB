"use client"

import { Suspense } from "react"
import SupplierVendorsPage from "./page"

export default function SuspenseWrapper() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <SupplierVendorsPage />
        </Suspense>
    )
}
