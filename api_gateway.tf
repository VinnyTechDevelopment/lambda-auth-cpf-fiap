resource "aws_apigatewayv2_api" "this" {
  name          = "${var.project_name}-api-gateway"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["POST", "OPTIONS"]
    allow_headers = ["content-type"]
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
# Este é o ponto em aberto: as demais rotas do Laravel (Cliente -> API
# Gateway -> EKS) ainda não têm uma integração aqui. As opções mais comuns:
#   a) VPC Link (HTTP API) apontando para o NLB interno do Service Laravel
#      dentro da mesma VPC — mantém o tráfego privado.
#   b) Rota curinga "ANY /{proxy+}" com integração HTTP simples apontando
#      pro endpoint público do LoadBalancer criado em app.tf.
# Ainda não implementado aqui porque depende de decidir se o Service da app
# continua público (LoadBalancer) ou vira "internal" — ver a nota no
# README-MIGRACAO.md do repositório da aplicação.
