// SPDX-License-Identifier: AGPL-3.0-or-later

use crate::{
    acl,
    api::client::AdminApiClient,
    middleware::{
        auth::AuthContext,
        csrf,
        flash::{self, FlashData},
    },
    state::AppState,
    templates::{
        components::{
            error_display::error_alert,
            form::{FORM_INPUT_CLASS, csrf_input, submit_button},
            page_container::page_header,
        },
        layout::admin_layout,
    },
};
use axum::{
    Extension, Form, Router,
    extract::{DefaultBodyLimit, Multipart, Path, Query, Request, State},
    http::StatusCode,
    response::{Html, IntoResponse, Response},
    routing::{get, post},
};
use base64::{Engine as _, engine::general_purpose::STANDARD};
use maud::{Markup, html};
use reqwest::Method;
use serde::Deserialize;
use serde_json::{Value, json};

#[derive(Deserialize)]
struct EconomyQuery {
    user_id: Option<String>,
    before: Option<String>,
}

#[derive(Deserialize)]
struct EconomyForm {
    payload: String,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/economy", get(economy_page))
        .route("/economy/upload", post(upload))
        .route("/economy/{operation}", post(mutate))
        .layer(DefaultBodyLimit::max(576 * 1024))
}

fn operation_config(operation: &str) -> Option<(&'static str, Method, &'static str)> {
    match operation {
        "catalog" => Some((acl::ECONOMY_CATALOG, Method::PUT, "/admin/economy/catalog")),
        "missions" => Some((
            acl::ECONOMY_MISSIONS,
            Method::PUT,
            "/admin/economy/missions",
        )),
        "settings" => Some((acl::ECONOMY_ADJUST, Method::PUT, "/admin/economy/settings")),
        "adjust" => Some((acl::ECONOMY_ADJUST, Method::POST, "/admin/economy/adjust")),
        "refund" => Some((acl::ECONOMY_ADJUST, Method::POST, "/admin/economy/refund")),
        "attest" => Some((acl::ECONOMY_MISSIONS, Method::POST, "/admin/economy/attest")),
        _ => None,
    }
}

fn valid_user_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 20 && id.bytes().all(|byte| byte.is_ascii_digit())
}

async fn economy_page(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthContext>,
    Query(query): Query<EconomyQuery>,
    request: Request,
) -> Response {
    if !acl::has_permission(auth.acls(), acl::ECONOMY_READ) {
        return StatusCode::FORBIDDEN.into_response();
    }
    let config = state.config();
    let client = AdminApiClient::new(state.http_client(), config, &auth.session);
    let csrf = csrf::get_csrf_token(&request);
    let action = format!("{}/economy", config.base_path);
    let economy = client.get::<Value>("/admin/economy", None).await;
    let user = if let Some(id) = query.user_id.as_deref().filter(|id| valid_user_id(id)) {
        let before = query.before.as_deref().map(|value| [("before", value)]);
        Some(
            client
                .get::<Value>(
                    &format!("/admin/economy/users/{id}"),
                    before.as_ref().map(|params| params.as_slice()),
                )
                .await,
        )
    } else {
        None
    };

    let content = html! {
        (page_header("Relay Points", Some("Katalog, görevler ve işlem denetimi")))
        @match economy {
            Err(_) => (error_alert("Ekonomi verileri yüklenemedi.")),
            Ok(data) => {
                div class="space-y-6" {
                    section {
                        h2 class="font-semibold" { "Ekonomi istatistikleri" }
                        p { "Cüzdan " (data["wallets"].as_str().unwrap_or("0")) " · Dolaşımdaki RP " (data["circulating"].as_str().unwrap_or("0")) }
                        p { "Kazanılan " (data["earned"].as_str().unwrap_or("0")) " · Harcanan " (data["spent"].as_str().unwrap_or("0")) }
                    }
                    section {
                        h2 class="font-semibold" { "Kullanıcı inceleme" }
                        form method="get" action=(&action) class="flex flex-wrap gap-2" {
                            label {
                                "Kullanıcı ID "
                                input class=(FORM_INPUT_CLASS) name="user_id" required pattern="[0-9]{1,20}"
                                    value=(query.user_id.as_deref().unwrap_or(""));
                            }
                            (submit_button("Getir"))
                        }
                        @if let Some(result) = user {
                            @match result {
                                Ok(user) => {
                                    pre class="max-h-96 overflow-auto text-sm" { (pretty(&user)) }
                                    @if let (Some(id), Some(next)) = (query.user_id.as_deref(), user["history"]["next"].as_str()) {
                                        a href={(action) "?user_id=" (id) "&before=" (next)} { "Daha eski işlemler" }
                                    }
                                },
                                Err(_) => (error_alert("Kullanıcının ekonomi verileri yüklenemedi.")),
                            }
                        }
                    }
                    @if acl::has_permission(auth.acls(), acl::ECONOMY_CATALOG) {
                        section class="space-y-3" {
                            h2 class="font-semibold" { "Kozmetik kataloğu" }
                            form method="post" enctype="multipart/form-data" action={(action) "/upload"} class="flex flex-wrap gap-2" {
                                (csrf_input(&csrf))
                                label { "Kozmetik görseli " input type="file" name="image" accept="image/png,image/webp,image/jpeg" required; }
                                label { "Gerekçe " input class=(FORM_INPUT_CLASS) name="reason" required minlength="5" maxlength="1000"; }
                                (submit_button("Görsel yükle"))
                            }
                            (editor(&action, &csrf, "catalog", "Kozmetik oluştur", &json!({
                                "id": "", "name": "", "description": "", "category": "avatar_frame", "rarity": "Rare",
                                "price": 700, "asset": "/economy/assets/violet_halo.svg", "static_asset": "/economy/assets/violet_halo-static.svg",
                                "animated": true, "premium": false, "published": false, "starts_at": null, "ends_at": null,
                                "stock": null, "collection_id": "relay_origins", "event_label": null, "reason": ""
                            })))
                            @for item in data["items"].as_array().into_iter().flatten() {
                                @let label = item["name"].as_str().unwrap_or("Kozmetik");
                                (editor(&action, &csrf, "catalog", label, &editable(item, &["sold", "updated_at"])))
                            }
                        }
                    }
                    @if acl::has_permission(auth.acls(), acl::ECONOMY_MISSIONS) {
                        section class="space-y-3" {
                            h2 class="font-semibold" { "Görevler ve kampanyalar" }
                            (editor(&action, &csrf, "missions", "Görev oluştur", &json!({
                                "id": "", "name": "", "description": "", "event": "campaign", "period": "daily",
                                "target": 1, "reward": 25, "premium": false, "premium_bonus": 0, "enabled": false,
                                "starts_at": null, "ends_at": null, "reason": ""
                            })))
                            @for mission in data["missions"].as_array().into_iter().flatten() {
                                (editor(&action, &csrf, "missions", mission["name"].as_str().unwrap_or("Görev"), &editable(mission, &["version"])))
                            }
                            (editor(&action, &csrf, "attest", "Etkinlik katılımını doğrula", &json!({
                                "user_id": "", "mission_id": "", "event_id": "", "reason": ""
                            })))
                        }
                    }
                    @if acl::has_permission(auth.acls(), acl::ECONOMY_ADJUST) {
                        section class="space-y-3" {
                            h2 class="font-semibold" { "Puan yönetimi" }
                            p { "İşlem anahtarı en az 8 karakter olmalıdır. Aynı işlemi yeniden gönderirken aynı anahtarı kullan." }
                            (editor(&action, &csrf, "adjust", "Bakiye düzelt", &json!({
                                "user_id": query.user_id.as_deref().unwrap_or(""), "amount": 0, "reason": "", "key": ""
                            })))
                            (editor(&action, &csrf, "refund", "Satın almayı iade et", &json!({
                                "user_id": query.user_id.as_deref().unwrap_or(""), "transaction_id": "", "reason": "", "key": ""
                            })))
                            (editor(&action, &csrf, "settings", "Günlük görev ödülü sınırı", &json!({
                                "daily_reward_cap": data["daily_reward_cap"].as_i64().unwrap_or(500), "reason": ""
                            })))
                        }
                    }
                    details {
                        summary { "Son ekonomi denetim kayıtları" }
                        pre class="max-h-96 overflow-auto text-sm" { (pretty(&data["audit"])) }
                    }
                }
            },
        }
    };
    Html(admin_layout(config, &auth, "Relay Points", "economy", None, content).into_string())
        .into_response()
}

fn pretty(value: &Value) -> String {
    serde_json::to_string_pretty(value).unwrap_or_default()
}

fn editable(value: &Value, ignored: &[&str]) -> Value {
    let mut value = value.clone();
    if let Some(fields) = value.as_object_mut() {
        for field in ignored {
            fields.remove(*field);
        }
        fields.insert("reason".into(), Value::String(String::new()));
    }
    value
}

fn editor(action: &str, csrf: &str, operation: &str, label: &str, value: &Value) -> Markup {
    html! {
        details class="rounded border p-3" {
            summary { (label) }
            form method="post" action={(action) "/" (operation)} class="mt-3 space-y-2" {
                (csrf_input(csrf))
                label class="block" {
                    "Alanlar (JSON)"
                    textarea class="block w-full font-mono" name="payload" rows="12" required maxlength="12000" { (pretty(value)) }
                }
                (submit_button("Kaydet"))
            }
        }
    }
}

async fn mutate(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthContext>,
    Path(operation): Path<String>,
    Form(form): Form<EconomyForm>,
) -> Response {
    let Some((permission, method, endpoint)) = operation_config(&operation) else {
        return StatusCode::NOT_FOUND.into_response();
    };
    if !acl::has_permission(auth.acls(), permission) {
        return StatusCode::FORBIDDEN.into_response();
    }
    let config = state.config();
    let back = format!("{}/economy", config.base_path);
    let payload = match serde_json::from_str::<Value>(&form.payload) {
        Ok(value) if value.is_object() && form.payload.len() <= 12_000 => value,
        _ => return flash::redirect_error(config, &back, "Geçerli bir JSON nesnesi gir."),
    };
    let client = AdminApiClient::new(state.http_client(), config, &auth.session);
    let result = client
        .send::<Value, _>(method, endpoint, Some(&payload), None)
        .await;
    let notice = match result {
        Ok(_) => FlashData::success("Ekonomi işlemi kaydedildi."),
        Err(error) => FlashData::error(
            error
                .validation_message()
                .or_else(|| error.detail_message())
                .unwrap_or_else(|| "Ekonomi işlemi kaydedilemedi.".to_owned()),
        ),
    };
    flash::redirect_with_flash(&back, notice, config.secure_cookies())
}

async fn upload(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthContext>,
    mut multipart: Multipart,
) -> Response {
    if !acl::has_permission(auth.acls(), acl::ECONOMY_CATALOG) {
        return StatusCode::FORBIDDEN.into_response();
    }
    let config = state.config();
    let back = format!("{}/economy", config.base_path);
    let mut image = None;
    let mut reason = None;
    loop {
        match multipart.next_field().await {
            Ok(Some(field)) => match field.name() {
                Some("image") => {
                    image = field
                        .bytes()
                        .await
                        .ok()
                        .filter(|bytes| !bytes.is_empty() && bytes.len() <= 512 * 1024)
                }
                Some("reason") => reason = field.text().await.ok(),
                _ => {}
            },
            Ok(None) => break,
            Err(_) => {
                return flash::redirect_error(config, &back, "Görsel yükleme formu okunamadı.");
            }
        }
    }
    let (Some(image), Some(reason)) = (image, reason) else {
        return flash::redirect_error(
            config,
            &back,
            "512 KB altında bir görsel ve yükleme gerekçesi gir.",
        );
    };
    let client = AdminApiClient::new(state.http_client(), config, &auth.session);
    let body = json!({"image": STANDARD.encode(image), "reason": reason});
    let result = client
        .send::<Value, _>(Method::POST, "/admin/economy/assets", Some(&body), None)
        .await;
    let notice = match result {
        Ok(value) => FlashData::success(format!(
            "Görsel adresi {}",
            value["asset"].as_str().unwrap_or_default()
        )),
        Err(_) => FlashData::error("Görsel yüklenemedi. PNG, WebP veya JPEG dosyası seç."),
    };
    flash::redirect_with_flash(&back, notice, config.secure_cookies())
}
