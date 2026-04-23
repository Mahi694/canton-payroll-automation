#!/bin/bash
#
# Copyright (c) 2024 Digital Asset (Canton) Holding Ltd. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#

# This script registers test employees (Alice and Bob) with the payroll system.
# It creates CompensationPackage and FixedDeduction contracts on a running
# Canton ledger via the JSON API.
#
# Pre-requisites:
# 1. A Canton sandbox must be running (`dpm sandbox`).
# 2. The project must be compiled (`dpm build`).
# 3. The `parties` in daml.yaml must include HR, Treasury, Alice, and Bob.
# 4. `curl`, `dpm`, and `jq` must be installed and in the PATH.

set -euo pipefail

# --- Configuration ---
readonly JSON_API_URL="http://localhost:7575"
readonly LEDGER_ID="sandbox" # As configured in dpm sandbox
readonly APPLICATION_ID="canton-payroll-automation" # `name` from daml.yaml

# Party display names (should match `parties` in daml.yaml)
readonly HR_PARTY_NAME="HR"
readonly TREASURY_PARTY_NAME="Treasury"
readonly ALICE_PARTY_NAME="Alice"
readonly BOB_PARTY_NAME="Bob"

# --- Helper Functions ---

# Function to check for required command-line tools
check_dependencies() {
  for cmd in curl dpm jq; do
    if ! command -v "$cmd" &> /dev/null; then
      echo "Error: Required command '$cmd' not found. Please install it and ensure it's in your PATH."
      exit 1
    fi
  done
}

# Function to find the DAR file and extract the main package ID
get_package_id() {
  local dar_file
  dar_file=$(find .daml/dist -name "*.dar" | head -n 1)
  if [[ -z "$dar_file" ]]; then
    echo "Error: No .dar file found in .daml/dist/. Please run 'dpm build' first."
    exit 1
  fi
  dpm damlc inspect-dar --json "$dar_file" | jq -r .main_package_id
}

# Function to generate a JWT token for the JSON API
# Usage: generate_jwt "admin" or generate_jwt "party" "full-party-id"
generate_jwt() {
  local payload
  if [[ "$1" == "admin" ]]; then
    payload=$(printf '{"https://daml.com/ledger-api": {"ledgerId": "%s", "applicationId": "%s", "admin": true}}' "$LEDGER_ID" "$APPLICATION_ID")
  elif [[ "$1" == "party" ]]; then
    local party_id=$2
    payload=$(printf '{"https://daml.com/ledger-api": {"ledgerId": "%s", "applicationId": "%s", "actAs": ["%s"]}}' "$LEDGER_ID" "$APPLICATION_ID" "$party_id")
  else
    echo "Error: Invalid JWT type specified. Use 'admin' or 'party <party_id>'."
    exit 1
  fi

  local header='{"alg":"none"}'
  # Use a portable way to do base64 url encoding
  local b64_header
  b64_header=$(echo -n "$header" | base64 | tr -d '\n' | tr -d '=' | tr '/+' '_-')
  local b64_payload
  b64_payload=$(echo -n "$payload" | base64 | tr -d '\n' | tr -d '=' | tr '/+' '_-')

  echo "${b64_header}.${b64_payload}."
}

# Function to get a party's full ID from its display name
get_party_id() {
  local display_name=$1
  local admin_token=$2

  local party_info
  party_info=$(curl -s -X GET -H "Authorization: Bearer $admin_token" "${JSON_API_URL}/v2/parties" \
    | jq -c --arg name "$display_name" '.parties[] | select(.displayName == $name)')

  if [[ -z "$party_info" ]]; then
    echo "Error: Party with display name '$display_name' not found." >&2
    echo "Please ensure the sandbox is running and the party is allocated (e.g., in daml.yaml)." >&2
    exit 1
  fi
  echo "$party_info" | jq -r '.party'
}

# Function to create a contract via the JSON API
create_contract() {
  local token=$1
  local template_id=$2
  local payload_json=$3

  echo "  Creating contract for template: $template_id"

  local response
  response=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "$payload_json" \
    "${JSON_API_URL}/v1/create")

  local http_code
  http_code=$(echo "$response" | tail -n1)
  local body
  body=$(echo "$response" | sed '$d')

  if [[ "$http_code" -eq 200 ]]; then
    local contract_id
    contract_id=$(echo "$body" | jq -r '.result.contractId')
    echo "  SUCCESS: Contract created with ID: $contract_id"
  else
    echo "  ERROR: Failed to create contract. HTTP status: $http_code" >&2
    echo "  Response: $(echo "$body" | jq .)" >&2
    exit 1
  fi
}

# --- Main Script ---

main() {
  echo "===== Canton Payroll: Registering Test Employees ====="

  check_dependencies

  echo
  echo "--- Step 1: Retrieving Package ID ---"
  local package_id
  package_id=$(get_package_id)
  echo "Package ID: $package_id"

  # Define template IDs using the retrieved package ID
  readonly TPL_COMPENSATION_PACKAGE="${package_id}:Employee.CompensationPackage"
  readonly TPL_FIXED_DEDUCTION="${package_id}:DeductionRule.FixedDeduction"

  echo
  echo "--- Step 2: Fetching Party IDs from Ledger ---"
  local admin_jwt
  admin_jwt=$(generate_jwt "admin")

  local hr_party_id
  hr_party_id=$(get_party_id "$HR_PARTY_NAME" "$admin_jwt")
  echo "HR Party ID:       $hr_party_id"

  local treasury_party_id
  treasury_party_id=$(get_party_id "$TREASURY_PARTY_NAME" "$admin_jwt")
  echo "Treasury Party ID: $treasury_party_id"

  local alice_party_id
  alice_party_id=$(get_party_id "$ALICE_PARTY_NAME" "$admin_jwt")
  echo "Alice's Party ID:  $alice_party_id"

  local bob_party_id
  bob_party_id=$(get_party_id "$BOB_PARTY_NAME" "$admin_jwt")
  echo "Bob's Party ID:    $bob_party_id"

  echo
  echo "--- Step 3: Generating HR Auth Token ---"
  local hr_jwt
  hr_jwt=$(generate_jwt "party" "$hr_party_id")
  echo "HR JWT generated."

  echo
  echo "--- Step 4: Registering Alice's Payroll Data ---"

  # Alice's Compensation Package
  local alice_comp_payload
  alice_comp_payload=$(jq -n \
    --arg hr "$hr_party_id" \
    --arg employee "$alice_party_id" \
    --arg treasury "$treasury_party_id" \
    '{
      "templateId": $ENV.TPL_COMPENSATION_PACKAGE,
      "payload": {
        "hr": $hr,
        "employee": $employee,
        "companyTreasury": $treasury,
        "annualGrossSalary": "120000.00",
        "payFrequency": "Monthly",
        "effectiveDate": "2024-01-01"
      }
    }')
  create_contract "$hr_jwt" "$TPL_COMPENSATION_PACKAGE" "$alice_comp_payload"

  # Alice's Health Insurance Deduction
  local alice_health_deduction_payload
  alice_health_deduction_payload=$(jq -n \
    --arg hr "$hr_party_id" \
    --arg employee "$alice_party_id" \
    '{
      "templateId": $ENV.TPL_FIXED_DEDUCTION,
      "payload": {
        "hr": $hr,
        "employee": $employee,
        "deductionId": "alice-health-insurance",
        "description": "Health Insurance Premium",
        "amountPerPayPeriod": "250.00"
      }
    }')
  create_contract "$hr_jwt" "$TPL_FIXED_DEDUCTION" "$alice_health_deduction_payload"

  # Alice's 401k Deduction
  local alice_401k_deduction_payload
  alice_401k_deduction_payload=$(jq -n \
    --arg hr "$hr_party_id" \
    --arg employee "$alice_party_id" \
    '{
      "templateId": $ENV.TPL_FIXED_DEDUCTION,
      "payload": {
        "hr": $hr,
        "employee": $employee,
        "deductionId": "alice-401k",
        "description": "401(k) Contribution",
        "amountPerPayPeriod": "500.00"
      }
    }')
  create_contract "$hr_jwt" "$TPL_FIXED_DEDUCTION" "$alice_401k_deduction_payload"

  echo
  echo "--- Step 5: Registering Bob's Payroll Data ---"

  # Bob's Compensation Package
  local bob_comp_payload
  bob_comp_payload=$(jq -n \
    --arg hr "$hr_party_id" \
    --arg employee "$bob_party_id" \
    --arg treasury "$treasury_party_id" \
    '{
      "templateId": $ENV.TPL_COMPENSATION_PACKAGE,
      "payload": {
        "hr": $hr,
        "employee": $employee,
        "companyTreasury": $treasury,
        "annualGrossSalary": "95000.00",
        "payFrequency": "BiWeekly",
        "effectiveDate": "2024-03-15"
      }
    }')
  create_contract "$hr_jwt" "$TPL_COMPENSATION_PACKAGE" "$bob_comp_payload"

  # Bob's Dental Insurance Deduction
  local bob_dental_deduction_payload
  bob_dental_deduction_payload=$(jq -n \
    --arg hr "$hr_party_id" \
    --arg employee "$bob_party_id" \
    '{
      "templateId": $ENV.TPL_FIXED_DEDUCTION,
      "payload": {
        "hr": $hr,
        "employee": $employee,
        "deductionId": "bob-dental-insurance",
        "description": "Dental Insurance Premium",
        "amountPerPayPeriod": "85.50"
      }
    }')
  create_contract "$hr_jwt" "$TPL_FIXED_DEDUCTION" "$bob_dental_deduction_payload"

  echo
  echo "===== Employee Registration Complete ====="
}

# Export read-only variables for use in subshells (e.g., in jq command)
export TPL_COMPENSATION_PACKAGE
export TPL_FIXED_DEDUCTION

# Execute the main function
main "$@"