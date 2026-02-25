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

// ── IMAP Mail ──

#[derive(Serialize, Deserialize, Clone)]
pub struct MailMeta {
    pub mail_id: String,
    pub sender_name: String,
    pub sender_email: String,
    pub subject: String,
    pub received_at: String,
    pub message_id: String,
}

struct PlainAuth {
    username: String,
    password: String,
}

impl imap::Authenticator for PlainAuth {
    type Response = String;
    fn process(&self, _data: &[u8]) -> Self::Response {
        format!("\0{}\0{}", self.username, self.password)
    }
}

fn imap_login(
    host: &str,
    port: u16,
    email: &str,
    password: &str,
) -> Result<imap::Session<native_tls::TlsStream<std::net::TcpStream>>, String> {
    let tls = native_tls::TlsConnector::builder()
        .build()
        .map_err(|e| format!("TLS error: {}", e))?;

    let client = imap::connect((host, port), host, &tls)
        .map_err(|e| format!("Connection failed: {}", e))?;

    // Try AUTHENTICATE PLAIN first, fallback to LOGIN
    let auth = PlainAuth {
        username: email.to_string(),
        password: password.to_string(),
    };

    match client.authenticate("PLAIN", &auth) {
        Ok(session) => Ok(session),
        Err((e, client)) => {
            // Fallback to LOGIN
            client
                .login(email, password)
                .map_err(|_| format!("AUTH_FAILED: {}", e))
        }
    }
}

#[tauri::command]
pub async fn test_imap_connection(
    host: String,
    port: u16,
    email: String,
    password: String,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let mut session = imap_login(&host, port, &email, &password)?;
        let _ = session.logout();
        Ok("OK".to_string())
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

#[tauri::command]
pub async fn fetch_mails(
    host: String,
    port: u16,
    email: String,
    password: String,
    since: Option<String>,
) -> Result<Vec<MailMeta>, String> {
    tokio::task::spawn_blocking(move || {
        let mut session = imap_login(&host, port, &email, &password)?;

        session
            .select("INBOX")
            .map_err(|e| format!("Select INBOX failed: {}", e))?;

        // Build IMAP SEARCH query
        let search_query = if let Some(ref since_date) = since {
            // since is ISO 8601, convert to IMAP date format (DD-Mon-YYYY)
            if let Some(imap_date) = iso_to_imap_date(since_date) {
                format!("SINCE {}", imap_date)
            } else {
                "ALL".to_string()
            }
        } else {
            // Default: last 7 days
            let seven_days_ago = chrono::Utc::now() - chrono::Duration::days(7);
            format!("SINCE {}", seven_days_ago.format("%d-%b-%Y"))
        };

        // Use UID SEARCH for stable IDs (matches NaverWorks nMailId)
        let uids = session
            .uid_search(&search_query)
            .map_err(|e| format!("Search failed: {}", e))?;

        if uids.is_empty() {
            let _ = session.logout();
            return Ok(vec![]);
        }

        // Fetch latest 50 mails max
        let mut uid_vec: Vec<u32> = uids.into_iter().collect();
        uid_vec.sort_unstable();
        let uid_list: Vec<String> = uid_vec
            .iter()
            .rev()
            .take(50)
            .map(|u| u.to_string())
            .collect();
        let uid_set = uid_list.join(",");

        // Use UID FETCH to get mail data by UID
        let messages = session
            .uid_fetch(&uid_set, "(UID ENVELOPE INTERNALDATE)")
            .map_err(|e| format!("Fetch failed: {}", e))?;

        let mut mails: Vec<MailMeta> = Vec::new();

        for msg in messages.iter() {
            let uid = msg.uid.unwrap_or(msg.message);

            if let Some(envelope) = msg.envelope() {
                let subject = envelope
                    .subject
                    .as_ref()
                    .map(|s| decode_imap_utf8(s))
                    .unwrap_or_else(|| "(제목 없음)".to_string());

                let (sender_name, sender_email) = envelope
                    .from
                    .as_ref()
                    .and_then(|addrs| addrs.first())
                    .map(|addr| {
                        let name = addr
                            .name
                            .as_ref()
                            .map(|n| decode_imap_utf8(n))
                            .unwrap_or_default();
                        let mailbox = addr
                            .mailbox
                            .as_ref()
                            .map(|m| String::from_utf8_lossy(m).to_string())
                            .unwrap_or_default();
                        let host = addr
                            .host
                            .as_ref()
                            .map(|h| String::from_utf8_lossy(h).to_string())
                            .unwrap_or_default();
                        let email_addr = if !mailbox.is_empty() && !host.is_empty() {
                            format!("{}@{}", mailbox, host)
                        } else {
                            mailbox
                        };
                        (name, email_addr)
                    })
                    .unwrap_or_default();

                let received_at = msg
                    .internal_date()
                    .map(|d| d.to_rfc3339())
                    .unwrap_or_default();

                let message_id = envelope
                    .message_id
                    .as_ref()
                    .map(|id| String::from_utf8_lossy(id).to_string())
                    .unwrap_or_default();

                mails.push(MailMeta {
                    mail_id: uid.to_string(),
                    sender_name,
                    sender_email,
                    subject,
                    received_at,
                    message_id,
                });
            }
        }

        // Sort by received_at descending
        mails.sort_by(|a, b| b.received_at.cmp(&a.received_at));

        let _ = session.logout();
        Ok(mails)
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

#[tauri::command]
pub async fn open_webmail(_mail_id: Option<String>) -> Result<String, String> {
    Ok("https://mail.worksmobile.com".to_string())
}

// ── Helpers ──

fn decode_imap_utf8(raw: &[u8]) -> String {
    let raw_str = String::from_utf8_lossy(raw).to_string();

    // Decode RFC 2047 encoded-words (e.g. =?UTF-8?B?...?= or =?UTF-8?Q?...?=)
    if !raw_str.contains("=?") {
        return raw_str;
    }

    let mut result = raw_str.clone();
    // Pattern: =?charset?encoding?encoded_text?=
    while let Some(start) = result.find("=?") {
        let rest = &result[start + 2..];
        let Some(end) = rest.find("?=") else { break };
        let encoded_word = &rest[..end];
        let parts: Vec<&str> = encoded_word.splitn(3, '?').collect();
        if parts.len() != 3 {
            break;
        }

        let encoding = parts[1].to_uppercase();
        let encoded_text = parts[2];

        let decoded = match encoding.as_str() {
            "B" => {
                data_encoding::BASE64
                    .decode(encoded_text.as_bytes())
                    .ok()
                    .and_then(|bytes| String::from_utf8(bytes).ok())
            }
            "Q" => {
                let bytes: Vec<u8> = decode_quoted_printable_header(encoded_text);
                String::from_utf8(bytes).ok()
            }
            _ => None,
        };

        if let Some(decoded_text) = decoded {
            let full_token = &result[start..start + 2 + end + 2];
            result = result.replacen(full_token, &decoded_text, 1);
        } else {
            break;
        }
    }

    result
}

fn decode_quoted_printable_header(input: &str) -> Vec<u8> {
    let mut result = Vec::new();
    let bytes = input.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'=' && i + 2 < bytes.len() {
            if let Ok(byte) = u8::from_str_radix(
                &String::from_utf8_lossy(&bytes[i + 1..i + 3]),
                16,
            ) {
                result.push(byte);
                i += 3;
                continue;
            }
        }
        if bytes[i] == b'_' {
            result.push(b' ');
        } else {
            result.push(bytes[i]);
        }
        i += 1;
    }
    result
}

fn iso_to_imap_date(iso: &str) -> Option<String> {
    let dt = chrono::DateTime::parse_from_rfc3339(iso).ok()?;
    Some(dt.format("%d-%b-%Y").to_string())
}
