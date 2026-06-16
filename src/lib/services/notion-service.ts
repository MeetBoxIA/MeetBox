import { getSupabase } from "../supabase";

export const NotionService = {
  /** Retrieves the Notion access token for a given user. */
  async getCredentials(userId: string) {
    const { data } = await getSupabase()
      .from("users")
      .select("notion_access_token")
      .eq("id", userId)
      .single();
    
    if (!data?.notion_access_token) return null;
    return { accessToken: data.notion_access_token };
  },

  /** Finds the first page the Notion integration has access to. */
  async getFirstAccessiblePage(token: string) {
    const res = await fetch("https://api.notion.com/v1/search", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28"
      },
      body: JSON.stringify({
        filter: { value: "page", property: "object" },
        page_size: 1
      })
    });
    
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.results || data.results.length === 0) return null;
    return data.results[0].id as string;
  },

  /** Creates a new Notion page (child of the first accessible page) with the action item details. */
  async createPage(userId: string, input: { title: string; content: string }) {
    const creds = await this.getCredentials(userId);
    if (!creds) return null;

    // Use the first page the integration was granted access to as the parent
    const parentId = await this.getFirstAccessiblePage(creds.accessToken);
    if (!parentId) {
      console.error("NotionService: No accessible pages found to use as parent.");
      return null;
    }

    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${creds.accessToken}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28"
      },
      body: JSON.stringify({
        parent: { type: "page_id", page_id: parentId },
        properties: {
          title: {
            title: [
              { text: { content: input.title } }
            ]
          }
        },
        children: [
          {
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [
                { type: "text", text: { content: input.content || "Sin descripción" } }
              ]
            }
          }
        ]
      })
    });

    if (!res.ok) {
      console.error("NotionService createPage error:", await res.text());
      return null;
    }

    const data = await res.json();
    return {
      id: data.id,
      url: data.url
    };
  }
};
