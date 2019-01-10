import React, { Component } from "react";
import "./App.css";

// TODO: See if service-workers can be leveraged somehow

/** Indicates the current state of the application */
enum FlowState {
  /** The user has just started */
  Start,
  /** The user needs to input their flow task */
  FlowPrompt,
  /** The user is flowing on a task */
  InFlow,
  /** The user is done and wants to see a summary of their work */
  FlowSummary
}

/** The number of seconds in a minute */
const SECONDS_IN_MINUTE = 60;
/** The default amount of time, in minutes, needed for a task
 * to be considered in flow, currently set to 1 hour */
const DEFAULT_ALLOWED_FLOW_LENGTH = 60;

/** The default application state */
const DEFAULT_STATE = {
  /** The time work was started */
  startTime: 0,
  /** The time work was ended */
  endTime: 0,
  /** The value of the input field for a flow task */
  flowInput: "",
  /** The current task being flowed on */
  currentFlow: null as IFlowItem | null,
  /** The current state of the application */
  flowState: FlowState.Start,
  /** A list of completed flow tasks */
  flows: [] as IFlowItem[],
  /** Whether we are transitioning between screens */
  inTransition: false,
  /** Amount of time, in milliseconds, for a given screen to transition */
  transitionTime: 0,
  /** Number of time, in minutes, for which flow tasks less than this are filtered out */
  filterFlowLength: DEFAULT_ALLOWED_FLOW_LENGTH
};

/**
 * An instance of flow
 */
interface IFlowItem {
  /** The name of the task being flowed */
  name: string;
  /** The time, in seconds, that the task was started */
  startTime: number;
  /** The time, in seconds, that the task was completed */
  endTime: number;
}

/**
 * Props for the FlowItem component
 */
interface IFlowItemProps {
  /** The percentage offset from the left */
  leftOffset: number;
  /** The percentage offset from the right */
  rightOffset: number;
  /** The name of the task */
  taskName: string;
  /** The number of minutes spent in flow */
  minutesOnFlow: number;
  /** Whether the flow item should represent the total work time, will add special styling */
  isTotal?: boolean;
}

/**
 * @returns the number of seconds in a date since
 * midnight of January 1, 1970
 */
const getTimeStamp = () => Date.now() / 1000;

/**
 * @returns minutes, rounded to the nearest whole number
 * @param seconds number of seconds to convert
 */
const secondsToMinutes = (seconds: number) =>
  Math.round(seconds / SECONDS_IN_MINUTE);

/**
 * @returns the % offset from the total
 * @param startTime the start time
 * @param endTime the end time
 * @param totalTime the total time
 */
const getOffset = (startTime: number, endTime: number, totalTime: number) =>
  ((endTime - startTime) / totalTime) * 100;

/**
 * @returns formatted time to display
 * @param time number of seconds since midnight of January 1, 1970
 */
const displayTimeStamp = (time: number) => {
  const timeStamp = new Date(time * 1000); // Convert seconds back to milliseconds
  const hours = timeStamp.getHours();
  const minutes = timeStamp.getMinutes();
  const ampm = hours >= 12 ? "pm" : "am";

  let formattedHours = hours % 12;
  formattedHours = hours == 0 ? 12 : formattedHours; // Zero hour is 12

  const formattedMinutes = minutes < 10 ? "0" + minutes : minutes;

  return formattedHours + ":" + formattedMinutes + ampm;
};

/**
 * @returns formatted time to display in hours and minutes
 * @param minutes number of minutes
 */
const displayTimeSpent = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const minutesRemaining = minutes % 60;

  return hours + " hours and " + minutesRemaining + " minutes";
};

/**
 * The flow application
 */
class App extends Component {
  /**
   * Tries to load in saved state
   * @param props there are no props
   */
  constructor(props: {}) {
    super(props);

    if (typeof Storage === "undefined") {
      return;
    }

    const localStateString = localStorage.getItem("state");
    if (localStateString && localStateString.length > 0) {
      const loadLocalState = confirm(
        "We found data from a previous flow session. Do you want to load it?"
      );
      if (loadLocalState) {
        this.state = JSON.parse(localStateString);
      }
    }
  }

  /** The state of the application */
  public state = DEFAULT_STATE;

  /** Renders the application */
  public render() {
    return (
      <div className="App">
        <this.StateWrapper>
          {this.state.flowState == FlowState.Start ? <this.StartScreen /> : ""}
          {this.state.flowState == FlowState.FlowPrompt ? (
            <this.FlowPrompt />
          ) : (
            ""
          )}
          {this.state.flowState == FlowState.InFlow ? <this.InFlow /> : ""}
          {this.state.flowState == FlowState.FlowSummary ? (
            <this.FlowSummary />
          ) : (
            ""
          )}
        </this.StateWrapper>

        {/* Keep end links outside of state wrapper so they don't awkwardly fade back in */}
        {this.state.flowState != FlowState.Start &&
        this.state.flowState != FlowState.FlowSummary ? (
          <this.EndFlowLink />
        ) : (
          ""
        )}
        {this.state.flowState == FlowState.FlowSummary ? (
          <this.ResetStateLink />
        ) : (
          ""
        )}
      </div>
    );
  }

  /**
   * Saves React app state to localStorage
   */
  private saveStateToLocal = () => {
    if (typeof Storage !== "undefined") {
      localStorage.setItem("state", JSON.stringify(this.state));
    } else {
      // Sorry! No Web Storage support..
    }
  };

  private StateWrapper: React.StatelessComponent<{
    className?: string;
  }> = ({ children, className }) => (
    <div
      className={
        this.state.inTransition
          ? className
            ? "fade-out" + className
            : "fade-out"
          : className
          ? "fade-in " + className
          : "fade-in"
      }
      style={{ animationDuration: this.state.transitionTime + "ms" }}
    >
      {children}
    </div>
  );

  /**
   * Triggers a transtion between states
   * @param nextState the state to transition to
   * @param transitionTime the amount of time, in milliseconds, to transition in/out of states
   * @param saveState whether to save app state to local storage after transition
   */
  private doTranistion = (
    nextState: FlowState,
    transitionTime: number,
    saveState?: boolean
  ) => {
    this.setState({ inTransition: true, transitionTime: transitionTime });

    setTimeout(() => {
      this.setState({ flowState: nextState, inTransition: false }, () => {
        if (saveState) {
          this.saveStateToLocal();
        }
      });
    }, transitionTime);
  };

  /**
   * The component for the start screen
   */
  private StartScreen = () => (
    <div>
      <h1>
        Welcome to <span className="fade-in ani-3 special">Flow</span>
      </h1>
      <button onClick={this.handleStartClick}>
        Click here to start flowing
      </button>
    </div>
  );

  /** Event handler for when the start button is clicked */
  private handleStartClick = (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    this.setState({ startTime: getTimeStamp() });
    this.doTranistion(FlowState.FlowPrompt, 500, true);
  };

  /**
   * The component for the flow input prompt
   */
  private FlowPrompt = () => (
    <div>
      <h1>What are you flowing on?</h1>
      <form onSubmit={this.handleFlowSubmit}>
        <input
          type="text"
          placeholder="My task"
          name="flow"
          value={this.state.flowInput}
          onChange={this.handleFlowInputChange}
          onFocus={this.handleInputFocus}
          style={{ width: "250px", marginRight: "1rem" }}
        />
        <button type="submit">Flow</button>
      </form>
    </div>
  );

  /** Event handler for when the flow input field is changed */
  private handleFlowInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ flowInput: e.target.value }, this.saveStateToLocal);
  };

  /** Event handler for when the flow input field gains focus */
  private handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  /** Event handler for when the flow task is submitted */
  private handleFlowSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const inputFlow = this.state.flowInput;

    if (inputFlow.length == 0) {
      return;
    }

    this.startFlow(inputFlow);
    this.doTranistion(FlowState.InFlow, 500, true);
  };

  /**
   * Creates and starts flow for a given task
   * @param taskName the name of the task to be flowed
   */
  private startFlow = (taskName: string) => {
    const flow = { name: taskName, startTime: getTimeStamp() };

    this.setState(
      {
        currentFlow: flow
      },
      this.saveStateToLocal
    );
  };

  /**
   * The component for the in-flow screen
   */
  private InFlow = () => (
    <div>
      <h1>
        You are flowing on{" "}
        {
          <span className="special">
            {this.state.currentFlow && this.state.currentFlow.name}
          </span>
        }
      </h1>
      <button onClick={this.handlePauseFlowClick}>Pause flow</button>
    </div>
  );

  /** Event handler for when the pause flow button is clicked */
  private handlePauseFlowClick = (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    this.endFlow();
    this.doTranistion(FlowState.FlowPrompt, 0, true);
  };

  /** Ends the current flow and adds it to the flow list */
  private endFlow = () => {
    if (!this.state.currentFlow || !this.state.currentFlow!.name) {
      return;
    }

    const flow = { ...this.state.currentFlow, endTime: getTimeStamp() };

    this.setState(
      {
        currentFlow: {},
        flows: [...this.state.flows, flow]
      },
      this.saveStateToLocal // TODO: is this needed, or would doTransition above be enough?
    );
  };

  /**
   * The component for a link to end work
   */
  private EndFlowLink = () => (
    <a href="#" className="end-flow-link" onClick={this.handleEndClick}>
      End your flow for today
    </a>
  );

  /** Event handler for when the end flow link is clicked */
  private handleEndClick = (
    e: React.MouseEvent<HTMLAnchorElement, MouseEvent>
  ) => {
    this.endFlow();
    this.setState({ endTime: getTimeStamp() }, () => {
      if (typeof Storage !== "undefined") {
        localStorage.clear();
      } else {
        // Sorry! No Web Storage support..
      }
    });
    this.doTranistion(FlowState.FlowSummary, 500);
  };

  /**
   * The component for the flow summary screen
   */
  private FlowSummary = () => {
    const dayStart = this.state.startTime;
    const dayEnd = this.state.endTime;
    const totalTime = dayEnd - dayStart;

    return (
      <div>
        <h1>Flow Summary</h1>
        <label>
          Filter flow less than {this.state.filterFlowLength} minutes
        </label>
        <input
          type="range"
          min="0"
          max="120"
          value={this.state.filterFlowLength}
          onChange={this.handleSliderChange}
        />
        <div className="flow-summary">
          <div className="flow-summary-time-ends">
            <h2>{displayTimeStamp(dayStart)}</h2>
            <h2>{displayTimeStamp(dayEnd)}</h2>
          </div>

          <this.FlowItem
            leftOffset={0}
            rightOffset={0}
            minutesOnFlow={secondsToMinutes(totalTime)}
            taskName="Total Time"
            isTotal={true}
          />

          {this.state.flows.map((flow, index) => {
            const flowTime = flow.endTime - flow.startTime;

            if (flowTime < this.state.filterFlowLength * SECONDS_IN_MINUTE) {
              return;
            }

            return (
              <this.FlowItem
                leftOffset={getOffset(dayStart, flow.startTime, totalTime)}
                rightOffset={getOffset(flow.endTime, dayEnd, totalTime)}
                minutesOnFlow={secondsToMinutes(flowTime)}
                taskName={flow.name}
                key={index}
              />
            );
          })}
        </div>
      </div>
    );
  };

  /**
   * The component for a flow item in the summary screen
   */
  private FlowItem = (props: IFlowItemProps) => (
    <div
      className="flow-summary-item"
      style={{
        marginLeft: props.leftOffset + "%",
        marginRight: props.rightOffset + "%"
      }}
    >
      <label style={{ margin: 0, whiteSpace: "nowrap" }}>
        {props.taskName}: {displayTimeSpent(props.minutesOnFlow)}
      </label>
      <div className={props.isTotal ? "total-div flow-div" : "flow-div"} />
    </div>
  );

  private handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) =>
    this.setState({ filterFlowLength: event.target.value });

  /**
   * The component for a link to end work
   */
  private ResetStateLink = () => (
    <a href="#" className="end-flow-link" onClick={this.handleResetClick}>
      Start over
    </a>
  );

  /** Event handler for when the end flow link is clicked */
  private handleResetClick = (
    e: React.MouseEvent<HTMLAnchorElement, MouseEvent>
  ) => {
    this.setState(DEFAULT_STATE);
  };
}

export default App;
