<!DOCTYPE html>
<html>

<head>
    <meta charset="UTF-8">
    <title>🎉 New Call Recorded! 🔔 - V General Contractors</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }

        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 10px;
        }

        .logo {
            text-align: center;
            margin-bottom: 25px;
        }

        .logo img {
            max-width: 180px;
            height: auto;
        }

        .details {
            line-height: 1.6;
            color: #333333;
        }

        .footer {
            margin-top: 25px;
            text-align: center;
            color: #666666;
            font-size: 14px;
        }

        .social-icons {
            margin: 20px 0;
            text-align: center;
        }

        .social-icons a {
            margin: 0 10px;
            display: inline-block;
        }

        .highlight {
            color: #28a745;
            font-weight: bold;
        }

        .call-banner {
            background: #e6f9e9;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
        }

        .call-icon {
            display: inline-block;
            margin-right: 5px;
            font-size: 1.2em;
            color: #28a745;
        }

        .details td {
            padding: 5px 0;
            vertical-align: top;
        }

        .details strong {
            display: inline-block;
            width: 150px;
        }
    </style>
</head>

<body>
    <div class="container">
        <div class="logo">
            <img src="https://vgeneralcontractors.com/assets/logo/logo-png.png" width="180"
                alt="Logo V General Contractors">
        </div>

        <div class="details">
            <h2 style="color: #28a745; text-align: center; border-bottom: 2px solid #28a745; padding-bottom: 10px;">🎉
                New Call Recorded! 🔔</h2>

            <div class="call-banner">
                <p style="text-align: center; margin: 0;">
                    A <span class="highlight">new call</span> has been recorded for
                    <strong>{{ \App\Models\CompanyData::first()->company_name ?? 'V General Contractors' }}</strong>!
                </p>
            </div>

            <h3 style="margin-top: 25px; margin-bottom: 15px; color: #333;">Call Details:</h3>
            <table style="width: 100%; margin: 0 0 20px 0; border-collapse: collapse;">
                <tr>
                    <td><span class="call-icon">📞</span> <strong>From Number:</strong></td>
                    <td>
                        @php
                            $phone = $callData['from_number'] ?? '';
                            // Remove any non-digit characters
                            $digitsOnly = preg_replace('/[^0-9]/', '', $phone);
                            // Format the number based on length
                            if (strlen($digitsOnly) == 10) {
                                $formattedPhone =
                                    '(' .
                                    substr($digitsOnly, 0, 3) .
                                    ') ' .
                                    substr($digitsOnly, 3, 3) .
                                    '-' .
                                    substr($digitsOnly, 6);
                            } elseif (strlen($digitsOnly) == 11 && substr($digitsOnly, 0, 1) == '1') {
                                // US number with country code
                                $formattedPhone =
                                    '(' .
                                    substr($digitsOnly, 1, 3) .
                                    ') ' .
                                    substr($digitsOnly, 4, 3) .
                                    '-' .
                                    substr($digitsOnly, 7);
                            } else {
                                // Fallback to original
                                $formattedPhone = $phone;
                            }
                            echo $formattedPhone;
                        @endphp
                    </td>
                </tr>
                <tr>
                    <td><span class="call-icon">📞</span> <strong>To Number:</strong></td>
                    <td>
                        @php
                            $phone = $callData['to_number'] ?? '';
                            // Remove any non-digit characters
                            $digitsOnly = preg_replace('/[^0-9]/', '', $phone);
                            // Format the number based on length
                            if (strlen($digitsOnly) == 10) {
                                $formattedPhone =
                                    '(' .
                                    substr($digitsOnly, 0, 3) .
                                    ') ' .
                                    substr($digitsOnly, 3, 3) .
                                    '-' .
                                    substr($digitsOnly, 6);
                            } elseif (strlen($digitsOnly) == 11 && substr($digitsOnly, 0, 1) == '1') {
                                // US number with country code
                                $formattedPhone =
                                    '(' .
                                    substr($digitsOnly, 1, 3) .
                                    ') ' .
                                    substr($digitsOnly, 4, 3) .
                                    '-' .
                                    substr($digitsOnly, 7);
                            } else {
                                // Fallback to original
                                $formattedPhone = $phone;
                            }
                            echo $formattedPhone;
                        @endphp
                    </td>
                </tr>
                <tr>
                    <td><span class="call-icon">⏱️</span> <strong>Duration:</strong></td>
                    <td>{{ isset($callData['duration_ms']) ? round($callData['duration_ms'] / 1000) . ' seconds' : 'N/A' }}
                    </td>
                </tr>
                <tr>
                    <td><span class="call-icon">📅</span> <strong>Date/Time:</strong></td>
                    <td>
                        @php
                            if (isset($callData['start_timestamp'])) {
                                $timestamp = $callData['start_timestamp'];
                                $timestampMs = strlen((string) $timestamp) < 13 ? $timestamp * 1000 : $timestamp;
                                $date = new \DateTime();
                                $date->setTimestamp($timestampMs / 1000);
                                echo $date->format('m/d/Y H:i:s');
                            } else {
                                echo 'N/A';
                            }
                        @endphp
                    </td>
                </tr>
                <tr>
                    <td><span class="call-icon">📊</span> <strong>Status:</strong></td>
                    <td>{{ $callData['call_status'] ?? 'N/A' }}</td>
                </tr>
                <tr>
                    <td><span class="call-icon">😊</span> <strong>Sentiment:</strong></td>
                    <td>{{ $callData['call_analysis']['user_sentiment'] ?? 'N/A' }}</td>
                </tr>
                @if (isset($callData['call_analysis']['call_summary']))
                    <tr>
                        <td><span class="call-icon">📝</span> <strong>Summary:</strong></td>
                        <td>{{ $callData['call_analysis']['call_summary'] }}</td>
                    </tr>
                @endif
            </table>

            @if (isset($callData['recording_url']))
                <div style="text-align: center; margin-top: 20px;">
                    <a href="{{ $callData['recording_url'] }}"
                        style="display: inline-block; background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                        ▶️ Listen to Recording
                    </a>
                </div>
            @endif

            <div style="padding: 15px; border-radius: 8px; margin-top: 25px; text-align: center;">
                <p>You can view more details about this call in the admin dashboard.</p>
            </div>
        </div>

        <div class="social-icons">
            @if (isset($companyData) && $companyData && $companyData->facebook_link)
                <a href="{{ $companyData->facebook_link }}" target="_blank">
                    <img src="https://cdn-icons-png.flaticon.com/512/124/124010.png" width="30" alt="Facebook">
                </a>
            @endif
            @if (isset($companyData) && $companyData && $companyData->instagram_link)
                <a href="{{ $companyData->instagram_link }}" target="_blank">
                    <img src="https://cdn-icons-png.flaticon.com/512/174/174855.png" width="30" alt="Instagram">
                </a>
            @endif
            @if (isset($companyData) && $companyData && $companyData->linkedin_link)
                <a href="{{ $companyData->linkedin_link }}" target="_blank">
                    <img src="https://cdn-icons-png.flaticon.com/512/174/174857.png" width="30" alt="LinkedIn">
                </a>
            @endif
            @if (isset($companyData) && $companyData && $companyData->twitter_link)
                <a href="{{ $companyData->twitter_link }}" target="_blank">
                    <img src="https://cdn-icons-png.flaticon.com/512/733/733579.png" width="30" alt="Twitter">
                </a>
            @endif
        </div>

        <div class="footer">
            <p>Business Hours:<br>
                Monday to Friday: 9:00 AM - 5:00 PM</p>
            <p style="margin-top: 10px; font-size: 12px;">© {{ date('Y') }}
                {{ isset($companyData) && $companyData ? $companyData->company_name : 'V General Contractors' }}.
                All rights reserved.</p>
            @if (isset($companyData) && $companyData && $companyData->address)
                <p style="font-size: 10px; color: #999;">{{ $companyData->address }}</p>
            @endif
        </div>
    </div>
</body>

</html>
