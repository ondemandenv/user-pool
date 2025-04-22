package main

import (
	"context"
	"encoding/json"
	"log"
	"os"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider"
)

// CognitoUserPoolEvent represents the common structure for Cognito trigger events.
// We only need UserPoolId and UserName for this specific trigger.
// Using a map allows flexibility if the event structure changes slightly.
type CognitoUserPoolEvent struct {
	UserPoolID string                 `json:"userPoolId"`
	UserName   string                 `json:"userName"`
	Request    map[string]interface{} `json:"request"` // Contains userAttributes etc.
	// Add other fields from the specific trigger event if needed
}

var cognitoClient *cognitoidentityprovider.Client

// init runs before the handler, suitable for initializing SDK clients.
func init() {
	// Load the default AWS configuration
	// This will use credentials from the Lambda execution environment
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		log.Fatalf("Failed to load AWS configuration: %v", err)
	}

	// Create the Cognito Identity Provider client
	cognitoClient = cognitoidentityprovider.NewFromConfig(cfg)
}

// HandleRequest processes the Cognito Post Confirmation event.
func HandleRequest(ctx context.Context, event json.RawMessage) (json.RawMessage, error) {
	// Log the raw event for debugging
	log.Printf("Received raw event: %s", string(event))

	// Unmarshal the event into our struct (or a map)
	var cognitoEvent CognitoUserPoolEvent
	if err := json.Unmarshal(event, &cognitoEvent); err != nil {
		log.Printf("Error unmarshalling event: %v", err)
		// Return the original event even on unmarshalling error to not block Cognito flow
		return event, nil
	}

	// Get required details from environment variables and event
	groupName := os.Getenv("GROUP_NAME")
	userPoolID := os.Getenv("USER_POOL_ID") // Prefer env var set by CDK
	if userPoolID == "" {
		userPoolID = cognitoEvent.UserPoolID // Fallback to event data
	}
	userName := cognitoEvent.UserName

	// --- Input Validation ---
	if groupName == "" {
		log.Println("Error: GROUP_NAME environment variable not set.")
		// Return the original event, don't block user confirmation
		return event, nil
	}
	if userPoolID == "" {
		log.Println("Error: Could not determine User Pool ID from environment or event.")
		return event, nil
	}
	if userName == "" {
		log.Println("Error: Username not found in the event.")
		return event, nil
	}

	log.Printf("Attempting to add user '%s' to group '%s' in pool '%s'", userName, groupName, userPoolID)

	// --- Call Cognito API ---
	addUserToGroupInput := &cognitoidentityprovider.AdminAddUserToGroupInput{
		GroupName:  aws.String(groupName),
		UserPoolId: aws.String(userPoolID),
		Username:   aws.String(userName),
	}

	_, err := cognitoClient.AdminAddUserToGroup(ctx, addUserToGroupInput)
	if err != nil {
		log.Printf("Error adding user '%s' to group '%s': %v", userName, groupName, err)
		// Log the error but return nil to allow the user confirmation process to succeed.
		// If adding to the group MUST succeed, you could return the error:
		// return event, fmt.Errorf("failed to add user to group: %w", err)
		return event, nil // Allow confirmation flow to continue
	}

	log.Printf("Successfully added user '%s' to group '%s'", userName, groupName)

	// Return the original event and nil error to signal success to Cognito
	return event, nil
}

// main is the entry point for the Lambda function.
func main() {
	// Start the Lambda handler
	lambda.Start(HandleRequest)
}
