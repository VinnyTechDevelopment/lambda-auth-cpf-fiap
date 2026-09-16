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

# --- Rotas autenticadas da API principal ---
# Decisão: rota proxy pública (opção "b" da nota antiga) em vez de VPC Link.
# Motivo: simplicidade e prazo — VPC Link exigiria trocar o Service Laravel
# pra "internal" e provisionar um recurso a mais (mais lento de aplicar no
# AWS Academy). O tráfego sai do API Gateway pro NLB público que app.tf já
# cria; quem protege a rota é o Lambda authorizer abaixo (authorizer.tf), não
# a rede. Ver detalhes em authorizer.tf e no README.
resource "aws_apigatewayv2_integration" "app_proxy" {
  api_id             = aws_apigatewayv2_api.this.id
  integration_type   = "HTTP_PROXY"
  integration_method = "ANY"
  integration_uri    = "http://${var.app_backend_domain}:${var.app_backend_port}/{proxy}"
  # Integrações HTTP_PROXY (não-Lambda) só suportam o formato 1.0.
  payload_format_version = "1.0"
}

# Rota curinga. O API Gateway sempre prioriza rotas literais (como
# "POST /auth/cpf" acima) sobre "{proxy+}" na hora de casar o path, então essa
# rota não interfere na rota de autenticação por CPF — nenhuma config extra
# de prioridade é necessária.
resource "aws_apigatewayv2_route" "app_proxy" {
  api_id    = aws_apigatewayv2_api.this.id
  route_key = "ANY /{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.app_proxy.id}"

  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.customer_jwt.id
}
