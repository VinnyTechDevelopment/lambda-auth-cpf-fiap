resource "aws_apigatewayv2_api" "this" {
  name          = "${var.project_name}-api-gateway"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["content-type", "authorization"]
  }
}

resource "aws_apigatewayv2_integration" "auth_cpf" {
  api_id                 = aws_apigatewayv2_api.this.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.auth_cpf.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "auth_cpf" {
  api_id    = aws_apigatewayv2_api.this.id
  route_key = "POST /auth/cpf"
  target    = "integrations/${aws_apigatewayv2_integration.auth_cpf.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.this.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth_cpf.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.this.execution_arn}/*/*"
}

# --- Rotas para os microsserviços (Fase 4) ---
#
# Um único API Gateway na frente dos 3 microsserviços. Cada um expõe um NLB
# próprio (Service LoadBalancer no EKS); o hostname de cada NLB entra aqui
# via secret (APP_BACKEND_DOMAIN, BILLING_BACKEND_DOMAIN,
# EXECUTION_BACKEND_DOMAIN). Enquanto um hostname estiver vazio (primeiro
# apply, antes do serviço existir), as rotas dele simplesmente não são
# criadas — o resto do apply segue normalmente.
#
# "overwrite:path = $request.path" repassa o path original (/api/...) para o
# backend, então uma integração por serviço atende todas as rotas dele.
#
#   os-service        : ANY /{proxy+}                       (rota padrão)
#   billing-service   : ANY /api/billing/{proxy+}
#   execution-service : ANY /api/catalog/{proxy+}, ANY /api/execution/{proxy+}
#
# Todas exigem JWT (authorizer: cliente OU funcionário), exceto as rotas
# públicas explícitas abaixo (login, links de orçamento do e-mail do cliente,
# webhook do Mercado Pago). O API Gateway sempre prioriza a rota mais
# específica, então as públicas vencem as curingas autenticadas.

locals {
  backends = {
    os        = var.app_backend_domain
    billing   = var.billing_backend_domain
    execution = var.execution_backend_domain
  }

  enabled_backends = { for name, domain in local.backends : name => domain if domain != "" }

  protected_routes = {
    "os:ANY /{proxy+}"                      = "os"
    "billing:ANY /api/billing/{proxy+}"     = "billing"
    "execution:ANY /api/catalog/{proxy+}"   = "execution"
    "execution:ANY /api/execution/{proxy+}" = "execution"
  }

  public_routes = {
    "os:POST /api/auth/login"                                 = "os"
    "os:POST /api/auth/register"                              = "os"
    "billing:GET /api/billing/quotes/{token}/approve"         = "billing"
    "billing:GET /api/billing/quotes/{token}/reject"          = "billing"
    "billing:POST /api/billing/quotes/{token}/decision"       = "billing"
    "billing:POST /api/billing/webhooks/mercadopago"          = "billing"
    "billing:POST /api/billing/payments/{paymentId}/simulate" = "billing"
  }
}

resource "aws_apigatewayv2_integration" "backend" {
  for_each = local.enabled_backends

  api_id             = aws_apigatewayv2_api.this.id
  integration_type   = "HTTP_PROXY"
  integration_method = "ANY"
  integration_uri    = "http://${each.value}:${var.app_backend_port}"

  request_parameters = {
    "overwrite:path" = "$request.path"
  }

  # Integrações HTTP_PROXY (não-Lambda) só suportam o formato 1.0.
  payload_format_version = "1.0"
}

resource "aws_apigatewayv2_route" "protected" {
  for_each = { for key, backend in local.protected_routes : key => backend if contains(keys(local.enabled_backends), backend) }

  api_id    = aws_apigatewayv2_api.this.id
  route_key = split(":", each.key)[1]
  target    = "integrations/${aws_apigatewayv2_integration.backend[each.value].id}"

  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.customer_jwt.id
}

resource "aws_apigatewayv2_route" "public" {
  for_each = { for key, backend in local.public_routes : key => backend if contains(keys(local.enabled_backends), backend) }

  api_id    = aws_apigatewayv2_api.this.id
  route_key = split(":", each.key)[1]
  target    = "integrations/${aws_apigatewayv2_integration.backend[each.value].id}"
}

# Os recursos antigos (count) viraram o for_each acima.
moved {
  from = aws_apigatewayv2_integration.app_proxy[0]
  to   = aws_apigatewayv2_integration.backend["os"]
}

moved {
  from = aws_apigatewayv2_route.app_proxy[0]
  to   = aws_apigatewayv2_route.protected["os:ANY /{proxy+}"]
}
