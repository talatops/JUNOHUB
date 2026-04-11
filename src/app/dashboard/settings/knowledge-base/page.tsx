import { redirect } from "next/navigation"

/** Old location; knowledge base lives under JUNO Engine. */
export default function KnowledgeBaseSettingsRedirectPage() {
    redirect("/dashboard/juno-engine/knowledge-base")
}
