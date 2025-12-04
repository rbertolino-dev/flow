import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization header required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get user from JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const body = await req.json();
    const { organization_id, path, method = "GET", data } = body;

    if (!organization_id || !path) {
      return new Response(JSON.stringify({ error: "organization_id and path are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user belongs to organization
    const { data: membership, error: membershipError } = await supabaseClient
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("organization_id", organization_id)
      .single();

    if (membershipError || !membership) {
      return new Response(JSON.stringify({ error: "Not authorized for this organization" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get n8n config for organization
    const { data: n8nConfig, error: configError } = await supabaseClient
      .from("n8n_configs")
      .select("*")
      .eq("organization_id", organization_id)
      .single();

    if (configError || !n8nConfig) {
      return new Response(JSON.stringify({ error: "n8n configuration not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build the full URL for n8n API
    const baseUrl = n8nConfig.api_url.replace(/\/$/, "");
    const fullUrl = `${baseUrl}${path.startsWith("/") ? path : "/" + path}`;

    // Prepare fetch options
    const fetchOptions: RequestInit = {
      method: method.toUpperCase(),
      headers: {
        "X-N8N-API-KEY": n8nConfig.api_key,
        "Content-Type": "application/json",
      },
    };

    // Add body for POST/PUT requests
    if (data && (method.toUpperCase() === "POST" || method.toUpperCase() === "PUT")) {
      fetchOptions.body = JSON.stringify(data);
    }

    // Make request to n8n API
    const n8nResponse = await fetch(fullUrl, fetchOptions);
    
    // Get response data
    let responseData;
    const contentType = n8nResponse.headers.get("content-type");
    
    if (contentType?.includes("application/json")) {
      responseData = await n8nResponse.json();
    } else {
      responseData = await n8nResponse.text();
    }

    // Update connection status based on response
    const connectionStatus = n8nResponse.ok ? "connected" : "error";
    await supabaseClient
      .from("n8n_configs")
      .update({
        connection_status: connectionStatus,
        last_connection_test: new Date().toISOString(),
      })
      .eq("id", n8nConfig.id);

    // Return response
    return new Response(JSON.stringify({
      success: n8nResponse.ok,
      status: n8nResponse.status,
      data: responseData,
    }), {
      status: n8nResponse.ok ? 200 : n8nResponse.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("n8n-proxy error:", error);
    return new Response(JSON.stringify({ 
      error: error.message || "Internal server error",
      success: false,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
