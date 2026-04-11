import { redirect } from "next/navigation"

/** @deprecated Use JUNO Engine → Storefront Chat */
export default function StorefrontChatRedirectPage() {
    redirect("/dashboard/juno-engine/storefront-chat")
}
