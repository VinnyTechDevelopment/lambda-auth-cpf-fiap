variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "project_name" {
  type    = string
  default = "techchallenge"
}

variable "environment" {
  type    = string
  default = "production"
}

variable "tf_state_bucket" {
  description = "Bucket S3 onde os states de infra-kubernetes e infra-database ficam guardados"
  type        = string
}

variable "lab_role_arn" {
  description = "ARN da LabRole do AWS Academy — a Lambda usa essa role em vez de uma role IAM criada pelo Terraform (Academy não permite criar roles novas)"
  type        = string
}

# --- Banco ---
# username/password precisam ser os mesmos configurados no infra-database

variable "db_username" {
  type    = string
  default = "techchallenge"
}

variable "db_password" {
  type      = string
  sensitive = true
}

# --- JWT ---

variable "customer_jwt_secret" {
  description = "Segredo usado para assinar o JWT de cliente. DIFERENTE do JWT_SECRET da API Laravel — este token não passa pelo guard jwt-auth existente, é validado por um middleware próprio no lado da aplicação."
  type        = string
  sensitive   = true
}

variable "customer_jwt_ttl_seconds" {
  description = "Tempo de vida do token de cliente, em segundos"
  type        = number
  default     = 3600
}

# --- Rota proxy pra app principal ---

variable "app_backend_domain" {
  description = "Hostname do NLB público do Service postech-app no repositório tech-challenge-fiap — obtido via 'make k8s-urls' lá DEPOIS que esse repositório for aplicado pela primeira vez. Como este repositório (lambda-auth-cpf) é aplicado ANTES do tech-challenge-fiap na ordem documentada, esse valor começa vazio e precisa ser preenchido manualmente depois, num segundo apply."
  type        = string
  default     = ""
}

variable "app_backend_port" {
  type    = number
  default = 8080
}
