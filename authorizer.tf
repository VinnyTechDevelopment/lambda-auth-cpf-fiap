# Lambda authorizer usada pela rota proxy "ANY /{proxy+}" em api_gateway.tf.
# O API Gateway HTTP API tem um "JWT authorizer" nativo, mas ele só valida
# tokens RS256 via JWKS de um IdP (Cognito, Auth0 etc.) — o token emitido por
# lambda-auth-cpf é HS256 com segredo compartilhado (CUSTOMER_JWT_SECRET), sem
# IdP nenhum. Por isso a validação precisa ser feita numa Lambda própria.

data "archive_file" "authorizer_package" {
  type        = "zip"
  source_dir  = "${path.module}/src-authorizer"
  output_path = "${path.module}/dist/authorizer.zip"
  excludes    = ["package-lock.json"]
}

resource "aws_lambda_function" "customer_jwt_authorizer" {
  function_name = "${var.project_name}-customer-jwt-authorizer"
  role          = var.lab_role_arn

  filename         = data.archive_file.authorizer_package.output_path
  source_code_hash = data.archive_file.authorizer_package.output_base64sha256

  handler     = "index.handler"
  runtime     = "nodejs20.x"
  timeout     = 5
  memory_size = 128

  # Só valida o JWT (sem tocar em RDS nem em nada dentro da VPC), então não
  # precisa de vpc_config — evita o cold start extra de uma Lambda em VPC.
  environment {
    variables = {
      CUSTOMER_JWT_SECRET = var.customer_jwt_secret
    }
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

resource "aws_cloudwatch_log_group" "customer_jwt_authorizer" {
  name              = "/aws/lambda/${aws_lambda_function.customer_jwt_authorizer.function_name}"
  retention_in_days = 7
}

resource "aws_apigatewayv2_authorizer" "customer_jwt" {
  api_id          = aws_apigatewayv2_api.this.id
  name            = "customer-jwt-authorizer"
  authorizer_type = "REQUEST"
  authorizer_uri  = aws_lambda_function.customer_jwt_authorizer.invoke_arn

  authorizer_payload_format_version = "2.0"
  enable_simple_responses           = true
  identity_sources                  = ["$request.header.Authorization"]
}

resource "aws_lambda_permission" "apigw_authorizer" {
  statement_id  = "AllowAPIGatewayInvokeAuthorizer"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.customer_jwt_authorizer.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.this.execution_arn}/*/*"
}
