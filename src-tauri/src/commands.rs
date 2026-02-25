use serde::{Deserialize, Serialize};

// ── Groq AI API ──

#[derive(Serialize)]
struct GroqRequest {
    model: String,
    messages: Vec<GroqMessage>,
    temperature: f64,
    max_tokens: u32,
    response_format: GroqResponseFormat,
}

#[derive(Serialize)]
struct GroqMessage {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct GroqResponseFormat {
    r#type: String,
}

#[derive(Deserialize)]
struct GroqResponse {
    choices: Vec<GroqChoice>,
}

#[derive(Deserialize)]
struct GroqChoice {
    message: GroqMessageResponse,
}

#[derive(Deserialize)]
struct GroqMessageResponse {
    content: String,
}

#[tauri::command]
pub async fn call_groq_api(
    api_key: String,
    system_prompt: String,
    user_prompt: String,
) -> Result<String, String> {
    let client = reqwest::Client::new();

    let request_body = GroqRequest {
        model: "llama-3.3-70b-versatile".to_string(),
        messages: vec![
            GroqMessage {
                role: "system".to_string(),
                content: system_prompt,
            },
            GroqMessage {
                role: "user".to_string(),
                content: user_prompt,
            },
        ],
        temperature: 0.3,
        max_tokens: 1024,
        response_format: GroqResponseFormat {
            r#type: "json_object".to_string(),
        },
    };

    let mut attempts = 0;
    loop {
        let response = client
            .post("https://api.groq.com/openai/v1/chat/completions")
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;

        let status = response.status();

        if status.as_u16() == 429 && attempts < 2 {
            attempts += 1;
            tokio::time::sleep(std::time::Duration::from_secs(10)).await;
            continue;
        }

        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Groq API error ({}): {}", status, error_text));
        }

        let groq_response: GroqResponse = response
            .json()
            .await
            .map_err(|e| format!("Parse error: {}", e))?;

        return groq_response
            .choices
            .first()
            .map(|c| c.message.content.clone())
            .ok_or_else(|| "Empty response from Groq".to_string());
    }
}

// ── NaverWorks Mail API ──

#[derive(Serialize, Deserialize)]
pub struct MailMeta {
    pub mail_id: String,
    pub sender_name: String,
    pub sender_email: String,
    pub subject: String,
    pub received_at: String,
}

#[tauri::command]
pub async fn fetch_mails(
    access_token: String,
    user_id: String,
    since: Option<String>,
) -> Result<Vec<MailMeta>, String> {
    let client = reqwest::Client::new();

    let mut url = format!(
        "https://www.worksapis.com/v1.0/users/{}/mail/inbox",
        user_id
    );

    if let Some(since_time) = since {
        url.push_str(&format!("?since={}", since_time));
    }

    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", access_token))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    let status = response.status();
    if status.as_u16() == 401 {
        return Err("UNAUTHORIZED".to_string());
    }

    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Mail API error ({}): {}", status, error_text));
    }

    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    let mails = body["mails"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|m| {
            Some(MailMeta {
                mail_id: m["mailId"].as_str()?.to_string(),
                sender_name: m["from"]["name"].as_str().unwrap_or("").to_string(),
                sender_email: m["from"]["address"].as_str().unwrap_or("").to_string(),
                subject: m["subject"].as_str().unwrap_or("(제목 없음)").to_string(),
                received_at: m["receivedTime"].as_str().unwrap_or("").to_string(),
            })
        })
        .collect();

    Ok(mails)
}

#[tauri::command]
pub async fn open_webmail(mail_id: Option<String>) -> Result<String, String> {
    match mail_id {
        Some(id) => Ok(format!(
            "https://mail.worksmobile.com/mail/read/{}",
            id
        )),
        None => Ok("https://mail.worksmobile.com".to_string()),
    }
}
