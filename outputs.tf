output "api_endpoint" {
  description = "URL base do API Gateway"
  value       = aws_apigatewayv2_api.this.api_endpoint
}

output "auth_cpf_route" {
  description = "URL completa do endpoint de autenticação por CPF"
  value       = "${aws_apigatewayv2_api.this.api_endpoint}/auth/cpf"
}

output "lambda_function_name" {
  value = aws_lambda_function.auth_cpf.function_name
}

output "lambda_security_group_id" {
  value = aws_security_group.lambda.id
}

output "app_proxy_base_url" {
  description = "Base do API Gateway na frente dos 3 microsserviços (os, billing, execution) — usar como PUBLIC_API_URL do billing-service"
  value       = aws_apigatewayv2_api.this.api_endpoint
}
