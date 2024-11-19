# ---------------------------------------------- #
#                    Commands                    #
# ---------------------------------------------- #
#? Array of all commands that should be registered. 'exit' is included automatically
#? Registered commands need to follow the convention cmd_<name>, where <name> is an element in the array
COMMANDS=(
    # -------- Batch
    "init" "reset" "deploy" "init_position"
    # -------- Market
    # Deployment
    "publish_market" "instantise_market" "link_price_stream" "add_asset"
    # Position management
    "open_position" "position_supply" "position_borrow" "position_withdraw" "position_repay"
    # Internal position operations
    "get_position_health"
    # -------- Cluster
    "publish_cluster"
    # -------- Price stream
    "publish_price_stream" "instantise_price_stream"
)

#. --------------- Batch Commands --------------- #
cmd_init() {
    . ./resim-helper.sh reset

    . ./resim-helper.sh deploy
}

cmd_reset() {
    resim reset

    heading "Initialising main account"
    temp_account=$(resim new-account)
    export main_account=$(printf "$temp_account" | grep Account | grep -o "account_.*")
    export main_privatekey=$(printf "$temp_account" | grep Private | sed "s/Private key: //")
    export main_account_badge=$(printf "$temp_account" | grep Owner | grep -o "resource_.*")
    export main_account_badge_global=$(printf "$main_account_badge" | sed 's/:.*//')

    heading "Initialising user account 1"
    temp_account=$(resim new-account)
    export user_account=$(printf "$temp_account" | grep Account | grep -o "account_.*")
    export user_privatekey=$(printf "$temp_account" | grep Private | sed "s/Private key: //")
    export user_account_badge=$(printf "$temp_account" | grep Owner | grep -o "resource_.*")
    export user_account_badge_global=$(printf "$user_account_badge" | sed 's/:.*//')

    export xrd=$(resim show $main_account | grep XRD | grep -o "resource_.\S*" | sed -e "s/://")

    heading "Assigned env variables"
    tbl_out "main_account:      " "$main_account"
    tbl_out "main privatekey:   " "$main_privatekey"
    tbl_out "main account_badge:" "$main_account_badge"
    printf "\n"
    tbl_out "user_account:      " "$user_account"
    tbl_out "user privatekey:   " "$user_privatekey"
    tbl_out "user account_badge:" "$user_account_badge"
    printf "\n"
    tbl_out "xrd:               " "$xrd"
}

cmd_deploy() {
    heading "Publishing price stream"
    . ./resim-helper.sh publish_price_stream

    heading "Instantising price stream"
    . ./resim-helper.sh instantise_price_stream

    heading "Publishing cluster"
    . ./resim-helper.sh publish_cluster

    heading "Publishing market"
    . ./resim-helper.sh publish_market

    if [[ $market_package = "" ]]; then
        printf ""
        return 0
    fi

    heading "Instantising market"
    . ./resim-helper.sh instantise_market

    heading "Linking price stream to market"
    . ./resim-helper.sh link_price_stream

    heading "Add XRD cluster"
    . ./resim-helper.sh add_asset
}

cmd_init_position() {
    . ./resim-helper.sh open_position

    . ./resim-helper.sh position_supply

    . ./resim-helper.sh position_borrow
}

#. --------------- Market Commands -------------- #
# Deployment
cmd_publish_market() {
    heading "Publishing market"
    export market_package=$(resim publish $(printf "$MARKET_PATH") | sed "s/Success! New Package: //")

    if [[ $market_package = "" ]]; then
        tput bold
        tput setaf 1
        printf "Failed to publish market; PriceStream or Cluster package probably changed address\n"
        tput sgr0
        return 0
    fi

    heading "Assigned env variables"
    tbl_out "market package:" "$market_package"
}

cmd_instantise_market() {
    # Validation
    is_pkg_deployed

    if [[ $PKG_DEPLOYED = "FALSE" ]]; then
        return 0
    fi

    heading "Creating market owner badge"
    create_market_owner_badge_rtm=$(resim run $(printf "$MARKET_PATH/$MARKET_MANIFESTS_PATH/create_market_badge.rtm"))
    export market_owner_badge=$(printf "$create_market_owner_badge_rtm" | grep "Resource: " | sed -n '1,1p' | grep -o "resource_.*")

    heading "Running transaction manifest"
    instantise_rtm=$(resim run $(printf "$MARKET_PATH/$MARKET_MANIFESTS_PATH/$INSTANTISE_MARKET_RTM"))
    # printf "$instantise_rtm"

    heading "Fetching component address"
    export market_component=$(printf "$instantise_rtm" | grep "Component:" | grep -o "component_.*")

    heading "Fetching resources"
    resources=$(printf "$instantise_rtm" | grep "Resource: ") # Gets all the outputted resource addresses
    # sed -n '[line],[line]p' specifies the line number of the resource address; both of the [line] parameters should be the same
    export market_position_badge=$(printf "$resources" | sed -n '2,2p' | grep -o "resource_.*")

    heading "Assigned env variables"
    tbl_out "market component:     " "$market_component"
    tbl_out "market position badge:" "$market_position_badge"
    tbl_out "xrd pool unit:        " "$xrd_pool_unit"
    tbl_out "market owner badge:   " "$market_owner_badge"
}

cmd_add_asset() {
    # Validation
    is_pkg_deployed

    if [[ $PKG_DEPLOYED = "FALSE" ]]; then
        return 0
    fi

    heading "Running transaction manifest"
    add_asset_rtm=$(resim run $(printf "$MARKET_PATH/$MARKET_MANIFESTS_PATH/add_asset.rtm"))

    export xrd_cluster=$(printf "$add_asset_rtm" | grep "Component:" | grep -o "component_.*")
    export xrd_unit=$(printf "$resources" | sed -n '3,3p' | grep -o "resource_.*")
}

# Position management
cmd_open_position() {
    # Validation
    is_pkg_deployed

    if [[ $PKG_DEPLOYED = "FALSE" ]]; then
        return 0
    fi

    use_account_user

    heading "Running transaction manifest"
    resim run $(printf "$MARKET_PATH/$MARKET_MANIFESTS_PATH/open_position.rtm")

    use_account_main
}

cmd_position_supply() {
    # Validation
    is_pkg_deployed

    if [[ $PKG_DEPLOYED = "FALSE" ]]; then
        return 0
    fi

    use_account_user

    heading "Running transaction manifest"
    resim run $(printf "$MARKET_PATH/$MARKET_MANIFESTS_PATH/position_supply.rtm")

    use_account_main
}

cmd_position_borrow() {
    # Validation
    is_pkg_deployed

    if [[ $PKG_DEPLOYED = "FALSE" ]]; then
        return 0
    fi

    use_account_user

    heading "Running transaction manifest"
    resim run $(printf "$MARKET_PATH/$MARKET_MANIFESTS_PATH/position_borrow.rtm")

    use_account_main
}

cmd_position_withdraw() {
    # Validation
    is_pkg_deployed

    if [[ $PKG_DEPLOYED = "FALSE" ]]; then
        return 0
    fi

    use_account_user

    heading "Running transaction manifest"
    resim run $(printf "$MARKET_PATH/$MARKET_MANIFESTS_PATH/position_withdraw.rtm")

    use_account_main
}

cmd_position_repay() {
    # Validation
    is_pkg_deployed

    if [[ $PKG_DEPLOYED = "FALSE" ]]; then
        return 0
    fi

    use_account_user

    heading "Running transaction manifest"
    resim run $(printf "$MARKET_PATH/$MARKET_MANIFESTS_PATH/position_repay.rtm")

    use_account_main
}

# Internal position operations
cmd_get_position_health() {
    # Validation
    is_pkg_deployed

    if [[ $PKG_DEPLOYED = "FALSE" ]]; then
        return 0
    fi

    use_account_user

    heading "Running transaction manifest"
    resim run $(printf "$MARKET_PATH/$MARKET_MANIFESTS_PATH/get_position_health.rtm")

    use_account_main
}

# Price stream management
cmd_link_price_stream() {
        # Validation
    is_pkg_deployed

    if [[ $PKG_DEPLOYED = "FALSE" ]]; then
        return 0
    fi

    heading "Running transaction manifest"
    resim run $(printf "$MARKET_PATH/$MARKET_MANIFESTS_PATH/$LINK_PRICE_STREAM_RTM")
}

#. -------------- Cluster Commands -------------- #
cmd_publish_cluster() {
    heading "Publishing cluster"
    export cluster_package=$(resim publish $(printf "$CLUSTER_PATH") | sed "s/Success! New Package: //")

    heading "Assigned env variables"
    tbl_out "cluster package:" "$cluster_package"
}

#. ------------ Price Stream Commands ----------- #
# Deployment
cmd_publish_price_stream() {
    heading "Publishing market"
    export price_stream_package=$(resim publish $(printf "$PRICE_STREAM_PATH") | sed "s/Success! New Package: //")

    heading "Assigned env variables"
    tbl_out "price stream package:" "$price_stream_package"
}

cmd_instantise_price_stream() {
    # Validation
    is_pkg_deployed

    if [[ $PKG_DEPLOYED = "FALSE" ]]; then
        return 0
    fi

    heading "Creating price stream owner badge"
    create_price_stream_owner_badge_rtm=$(resim run $(printf "$PRICE_STREAM_PATH/$PRICE_STREAM_MANIFESTS_PATH/create_price_stream_badge.rtm"))
    export price_stream_owner_badge=$(printf "$create_price_stream_owner_badge_rtm" | grep "Resource: " | sed -n '1,1p' | grep -o "resource_.*")

    heading "Running transaction manifest"
    instantise_rtm=$(resim run $(printf "$PRICE_STREAM_PATH/$PRICE_STREAM_MANIFESTS_PATH/$INSTANTISE_PRICE_STREAM_RTM"))

    heading "Fetching component address"
    export price_stream_component=$(printf "$instantise_rtm" | grep "Component:" | grep -o "component_.*")
    printf "$price_stream_component"

    heading "Fetching resources"
    resources=$(printf "$instantise_rtm" | grep "Resource: ") # Gets all the outputted resource addresses
    printf "$resources" | grep -o "Resource:.*"
    # sed -n '[line],[line]p' specifies the line number of the resource address; both of the [line] parameters should be the same
    # export price_stream_owner_badge=$(printf "$resources" | sed -n '1,1p' | grep -o "resource_.*")

    heading "Assigned env variables"
    tbl_out "price stream component:  " "$price_stream_component"
    tbl_out "price stream owner badge:" "$price_stream_owner_badge"
}

# ---------------------------------------------- #
#                  Resim Helper                  #
# ---------------------------------------------- #
# ------------------ Variables ----------------- #
# SCRIPT_SHELL="$(readlink /proc/$$/exe | sed "s/.*\///")"

# Validation function return values
PKG_DEPLOYED="TRUE"
COMPONENT_INST="TRUE"

MARKET_PATH="/home/tymur/programs/lending-dapp/scrypto/market"
MARKET_MANIFESTS_PATH="manifests"
INSTANTISE_MARKET_RTM="instantise.rtm"
LINK_PRICE_STREAM_RTM="link_price_stream.rtm"

PRICE_STREAM_PATH="/home/tymur/programs/lending-dapp/scrypto/price-stream"
PRICE_STREAM_MANIFESTS_PATH="manifests"
INSTANTISE_PRICE_STREAM_RTM="instantise.rtm"

CLUSTER_PATH="/home/tymur/programs/lending-dapp/scrypto/cluster"

# ------------------ Functions ----------------- #
# Text formatting
cmd_heading() { printf "\n$(tput bold)$(tput smul)$(tput setaf 2)$1$(tput sgr0)\n"; }
heading() { printf "\n$(tput bold)$(tput setaf 4)] $1$(tput sgr0)\n"; }
tbl_out() { printf "$(tput bold)$1$(tput sgr0) $2\n"; }

# Validation functions
is_pkg_deployed() {
    tput bold
    tput setaf 1

    if [[ "$(resim show)" = "" ]]; then
        printf "Error: Resim not initialised or default account unset"
        PKG_DEPLOYED="FALSE"
    elif [[ -z ${main_account+x} ]]; then
        printf "Error: Resim not initialised or issue with account env. variable"
        PKG_DEPLOYED="FALSE"
    elif [[ -z ${xrd+x} ]]; then
        printf "Error: Resim not initialised or issue with xrd env. variable"
        PKG_DEPLOYED="FALSE"
    elif [[ -z ${price_stream_package+x} ]]; then
        printf "Error: PriceStream package not deployed or issue with package env. variable"
        PKG_DEPLOYED="FALSE"
    fi

    tput sgr0
}

# Resim account management functions
use_account_main() {
    heading "Set main account as default"
    resim set-default-account $main_account $main_privatekey $main_account_badge
}

use_account_user() {
    heading "Set user account as default"
    resim set-default-account $user_account $user_privatekey $user_account_badge
}

# --------------- Pre-run Checks --------------- #
# Check that the manifest path is set
if [[ $MANIFESTS_PATH = "[DEFAULT]" ]]; then
    printf "Path to manifest directory not set. Run |printf \"\$PWD\"| to get the current path."
    printf "Current path is:\n$PWD"
    return 0
fi


# ------------------- Runtime ------------------ #
# TITLE='
#     ____            _              __  __     __
#    / __ \___  _____(_)___ ___     / / / /__  / /___  ___  _____
#   / /_/ / _ \/ ___/ / __ `__ \   / /_/ / _ \/ / __ \/ _ \/ ___/
#  / _, _/  __(__  ) / / / / / /  / __  /  __/ / /_/ /  __/ /
# /_/ |_|\___/____/_/_/ /_/ /_/  /_/ /_/\___/_/ .___/\___/_/
#                                            /_/'

declare -a TITLE_ARRAY=(
    '    ____            _              __  __     __               '
    '   / __ \___  _____(_)___ ___     / / / /__  / /___  ___  _____'
    '  / /_/ / _ \/ ___/ / __ `__ \   / /_/ / _ \/ / __ \/ _ \/ ___/'
    ' / _, _/  __(__  ) / / / / / /  / __  /  __/ / /_/ /  __/ /    '
    '/_/ |_|\___/____/_/_/ /_/ /_/  /_/ /_/\___/_/ .___/\___/_/     '
    '                                           /_/                 '
)
# Print and center the title

# If no parameters passed
if [[ $# -eq 0 ]]; then
    tput bold
    tput setaf 2
    for line in "${TITLE_ARRAY[@]}"; do
        printf "%*s\n" $(((${#line} + $COLUMNS) / 2)) "$line"
    done
    tput sgr0

    PS3="Choose number of command to run: $(tput sgr0)"

    while true; do
        # Show command list as bold, yellow
        tput bold
        tput setaf 3

        select command in "${COMMANDS[@]}" exit; do
            tput sgr0
            printf ""

            case $command in
            "exit")
                return 0
                ;;
            *)
                if [[ "$(printf "${COMMANDS[*]}" | grep -Fw "$command")" != "" ]]; then # Check if input command is in the COMMANDS array
                    cmd_heading "Running command [$command]"
                    # Format the input command to match the function name and execute
                    func="cmd_$command"
                    ${func}

                    break # Since in a while loop, prompt re-displayed
                else
                    printf "$(tput bold)$(tput setaf 1)Invalid option $REPLY $(tput sgr0)\n"
                fi
                ;;
            esac
        done
    done
# If parameter(s) passed; 1st treated as the function name
else
    if [[ "$(printf "${COMMANDS[*]}" | grep -Fw "$1")" != "" ]]; then # Check if input command is in the COMMANDS array
        cmd_heading "Running command [$1]"
        # Format the input command to match the function name and execute
        func="cmd_$1"
        ${func}
    else
        printf "$(tput bold)$(tput setaf 1)Invalid command '$1' passed. Input one of:$(tput sgr0)\n${COMMANDS[*]}\n"
    fi
fi
